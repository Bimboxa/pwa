import {
  WALL_DETECTION_M,
  buildForeignEdges,
  classifyRingContours,
  signedArea2,
  subdivideRingByForeignProjections,
} from "Data/edx/automatedAnnotationsProcedures/fromPolygonsToBim";

const COLINEAR_TOL_PX = 0.5;
const COINCIDENT_TOL_PX = 0.5;

function projectStrict(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return null;
  const t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  if (t < -0.001 || t > 1.001) return null;
  const tc = Math.max(0, Math.min(1, t));
  const projX = ax + tc * abx;
  const projY = ay + tc * aby;
  return { t: tc, dist: Math.hypot(px - projX, py - projY), x: projX, y: projY };
}

function clampedProjection(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return { x: ax + t * abx, y: ay + t * aby };
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Strict interior classification: a segment is INT (facing a specific foreign
 * polygon) iff there exists a foreign edge such that:
 *  - both endpoints project strictly inside the foreign edge (t ∈ [0,1])
 *  - both endpoints are within detectionPx of the foreign edge
 *  - the foreign edge lies in the OUTWARD direction from the segment midpoint
 * Returns the index of the facing foreign polygon, or -1.
 */
function classifySegmentStrict(a, b, foreignEdges, detectionPx, outwardSign) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return -1;
  const nx = (outwardSign * dy) / len;
  const ny = (outwardSign * -dx) / len;

  let bestIdx = -1;
  let bestScore = Infinity;
  for (const e of foreignEdges) {
    const p1 = projectStrict(a.x, a.y, e.ax, e.ay, e.bx, e.by);
    if (!p1 || p1.dist > detectionPx) continue;
    const p2 = projectStrict(b.x, b.y, e.ax, e.ay, e.bx, e.by);
    if (!p2 || p2.dist > detectionPx) continue;

    const pm = clampedProjection(mx, my, e.ax, e.ay, e.bx, e.by);
    const vx = pm.x - mx;
    const vy = pm.y - my;
    if (vx * nx + vy * ny <= 1e-6) continue;

    const score = p1.dist + p2.dist;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = e.polygonIndex;
    }
  }
  return bestIdx;
}

function minDistChainToChainSq(chainA, chainB) {
  let best = Infinity;
  for (const a of chainA) {
    for (const b of chainB) {
      const d = distSq(a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

function dedupeCoincidentColinear(points) {
  if (points.length < 2) return points;

  const dedup = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = dedup[dedup.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) > COINCIDENT_TOL_PX) {
      dedup.push(points[i]);
    }
  }
  if (dedup.length >= 2) {
    const first = dedup[0];
    const lastPt = dedup[dedup.length - 1];
    if (Math.hypot(first.x - lastPt.x, first.y - lastPt.y) <= COINCIDENT_TOL_PX) {
      dedup.pop();
    }
  }
  if (dedup.length < 3) return dedup;

  const result = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = dedup[i];
    const next = dedup[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      result.push(curr);
      continue;
    }
    const dist = Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / len;
    if (dist > COLINEAR_TOL_PX) result.push(curr);
  }
  result.push(dedup[dedup.length - 1]);
  return result;
}

/**
 * Build the per-polygon outer-ring data: augmented ring (with subdivision
 * points where neighbor vertices project onto the ring) + per-segment
 * classification tagged with the index of the facing foreign polygon.
 */
function buildPolyData(polygons, i, detectionPx) {
  const poly = polygons[i];
  if (!poly?.points || poly.points.length < 3) return null;

  const foreignEdges = buildForeignEdges(polygons, i);
  if (foreignEdges.length === 0) return null;

  const outwardSign = signedArea2(poly.points) >= 0 ? 1 : -1;
  const augmentedRing = subdivideRingByForeignProjections(
    poly.points,
    foreignEdges,
    detectionPx,
  );
  const N = augmentedRing.length;

  const facingPerEdge = [];
  for (let k = 0; k < N; k++) {
    const a = augmentedRing[k];
    const b = augmentedRing[(k + 1) % N];
    facingPerEdge.push(
      classifySegmentStrict(a, b, foreignEdges, detectionPx, outwardSign),
    );
  }
  return { polygonIndex: i, augmentedRing, facingPerEdge };
}

/**
 * Group contiguous edges with the same facing polygon index into sub-chains.
 * Each sub-chain represents a portion of the polygon's outer ring that faces
 * a single neighbor polygon.
 *
 * Returns Array<{ facingPolyIdx, points: Array<{x, y, id?}> }>.
 */
function extractSubChains(data) {
  if (!data) return [];
  const { augmentedRing, facingPerEdge } = data;
  const N = augmentedRing.length;
  if (facingPerEdge.every((idx) => idx === -1)) return [];

  let startK = 0;
  for (let k = 0; k < N; k++) {
    const prev = facingPerEdge[(k - 1 + N) % N];
    const curr = facingPerEdge[k];
    if (curr !== -1 && prev !== curr) {
      startK = k;
      break;
    }
  }

  const chains = [];
  let visited = 0;
  while (visited < N) {
    const idx = (startK + visited) % N;
    const facing = facingPerEdge[idx];
    if (facing === -1) {
      visited++;
      continue;
    }
    const chainPoints = [augmentedRing[idx]];
    let count = 0;
    while (visited + count < N) {
      const cIdx = (startK + visited + count) % N;
      if (facingPerEdge[cIdx] !== facing) break;
      chainPoints.push(augmentedRing[(cIdx + 1) % N]);
      count++;
    }
    chains.push({ facingPolyIdx: facing, points: chainPoints });
    visited += count;
  }
  return chains;
}

/**
 * Compute wall-surface POLYGON contours between adjacent source polygons.
 *
 * Pure topological approach: vertices of the returned polygons are either
 * existing source-polygon vertices (kept as `sourcePointId`) or projection
 * points where a neighbor's vertex projects onto a source polygon's edge.
 * No dilation, no boolean clipping.
 *
 * Algorithm:
 *  1. For each polygon i, augment its outer ring with foreign-vertex
 *     projections (`subdivideRingByForeignProjections`) and classify each
 *     augmented segment as INT (facing a specific neighbor j) or EXT.
 *  2. Group contiguous INT segments into sub-chains tagged with their
 *     facing neighbor index.
 *  3. For each unordered pair (i, j) of source polygons, pair the closest
 *     facing sub-chains and emit a closed POLYGON formed by:
 *       chain_i forward + chain_j reversed (orientation chosen so the
 *       connector edges between the two chains are the shortest possible).
 *
 * @param {Object} args
 * @param {Array<{points: Array<{x:number,y:number,id?:string}>, cuts?: any}>} args.polygons
 *   source polygons in pixel space; each `points[k]` must carry the original
 *   point ID when available so the result can reference shared point IDs.
 * @param {number} args.meterByPx
 *   image scale (meters per pixel). Drives WALL_DETECTION_M → detectionPx.
 * @returns {Array<{ pointsPx: Array<{x:number,y:number,sourcePointId?:string}> }>}
 */
export default function computeInteriorContourPolygons({ polygons, meterByPx }) {
  if (!polygons || polygons.length < 1) {
    console.warn("[computeInteriorContourPolygons] need ≥1 polygon, got", polygons?.length);
    return [];
  }
  if (!(meterByPx > 0)) {
    console.warn("[computeInteriorContourPolygons] invalid meterByPx", meterByPx);
    return [];
  }

  const detectionPx = WALL_DETECTION_M / meterByPx;
  console.log(
    `[computeInteriorContourPolygons] ${polygons.length} polygons, meterByPx=${meterByPx}, detectionPx=${detectionPx.toFixed(2)}px`
  );

  const wallPolygons = [];

  // 1. Single-polygon internal branches: each polygon's outer ring is scanned
  //    by classifyRingContours, which detects "narrow passages" where the ring
  //    nearly folds back onto itself. Each detected int chain is the path
  //    around one such branch and, when closed, forms a wall-surface contour.
  for (let i = 0; i < polygons.length; i++) {
    const poly = polygons[i];
    if (!poly?.points || poly.points.length < 3) continue;
    const { int } = classifyRingContours(poly.points, meterByPx);
    const byId = {};
    for (const pt of poly.points) byId[pt.id] = pt;
    const resolveChain = (chain) =>
      chain.map((entry) => (typeof entry === "string" ? byId[entry] : entry));
    const wallChains = int.map(resolveChain);
    console.log(
      `  poly[${i}] outer-ring: ${poly.points.length} pts, internal wall chains=${wallChains.length}`
    );
    for (const chain of wallChains) {
      if (!chain || chain.length < 2) continue;
      const cleaned = dedupeCoincidentColinear(chain);
      if (cleaned.length < 3) continue;
      wallPolygons.push({
        pointsPx: cleaned.map((pt) => ({
          x: pt.x,
          y: pt.y,
          sourcePointId: pt.id || undefined,
        })),
      });
    }
  }

  // 2. Inter-polygon walls: when ≥2 source polygons are provided, also build
  //    walls that sit between adjacent polygons (the "gap strips" from the
  //    original feature requirement).
  if (polygons.length < 2) {
    console.log(`[computeInteriorContourPolygons] produced ${wallPolygons.length} wall polygons (single-polygon mode)`);
    return wallPolygons;
  }

  const polyData = polygons.map((_, i) => buildPolyData(polygons, i, detectionPx));
  const subChainsByPoly = polyData.map(extractSubChains);

  for (let i = 0; i < polygons.length; i++) {
    const chains = subChainsByPoly[i];
    console.log(
      `  poly[${i}]: ${polygons[i].points?.length} pts, augmented=${polyData[i]?.augmentedRing?.length ?? 0}, INT sub-chains=${chains.length} facing=[${chains.map((c) => c.facingPolyIdx).join(",")}]`
    );
  }

  const usedJ = new Set();

  for (let i = 0; i < polygons.length; i++) {
    const chainsI = subChainsByPoly[i];
    for (let cI = 0; cI < chainsI.length; cI++) {
      const chainI = chainsI[cI];
      const j = chainI.facingPolyIdx;
      if (j <= i) continue;

      const chainsJ = subChainsByPoly[j];
      let bestCJ = -1;
      let bestScore = Infinity;
      for (let cJ = 0; cJ < chainsJ.length; cJ++) {
        if (usedJ.has(`${j}-${cJ}`)) continue;
        const chainJ = chainsJ[cJ];
        if (chainJ.facingPolyIdx !== i) continue;
        const score = minDistChainToChainSq(chainI.points, chainJ.points);
        if (score < bestScore) {
          bestScore = score;
          bestCJ = cJ;
        }
      }
      if (bestCJ === -1) {
        console.warn(
          `[computeInteriorContourPolygons] no matching chain in poly[${j}] for poly[${i}] chain ${cI}`
        );
        continue;
      }
      usedJ.add(`${j}-${bestCJ}`);

      const chainJ = chainsJ[bestCJ];
      const cIStart = chainI.points[0];
      const cIEnd = chainI.points[chainI.points.length - 1];
      const cJStart = chainJ.points[0];
      const cJEnd = chainJ.points[chainJ.points.length - 1];

      const orderForward = distSq(cIEnd, cJStart) + distSq(cJEnd, cIStart);
      const orderReverse = distSq(cIEnd, cJEnd) + distSq(cJStart, cIStart);
      const chainJOrdered =
        orderForward <= orderReverse ? chainJ.points : [...chainJ.points].reverse();

      const wallRaw = [...chainI.points, ...chainJOrdered];
      const cleaned = dedupeCoincidentColinear(wallRaw);
      if (cleaned.length < 3) {
        console.warn(
          `[computeInteriorContourPolygons] wall poly degenerate after cleanup (${cleaned.length} pts) for pair (${i},${j})`
        );
        continue;
      }

      const wallPoints = cleaned.map((pt) => ({
        x: pt.x,
        y: pt.y,
        sourcePointId: pt.id || undefined,
      }));
      wallPolygons.push({ pointsPx: wallPoints });
    }
  }

  console.log(`[computeInteriorContourPolygons] produced ${wallPolygons.length} wall polygons`);
  return wallPolygons;
}
