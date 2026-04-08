import { nanoid } from "@reduxjs/toolkit";

import matchAnnotationTemplate from "Features/annotationsAuto/utils/matchAnnotationTemplate";
import findReentrantAngles from "Features/geometry/utils/findReentrantAngles";
import mergePolylines from "Features/geometry/utils/mergePolylines";

const WALL_DETECTION_M = 0.6; // characteristic distance to detect wall branches
const MIN_INDEX_DISTANCE = 2; // minimum index gap to consider two points non-adjacent
const STRIP_TEST_OFFSET = 5; // px offset to test strip orientation
const INTERIOR_CUT_MAX_M = 0.5; // max dimension (meters) to classify a cut as interior (wall/pillar)

// ---------------------------------------------------------------------------
// Geometry helpers

/**
 * Ray-casting point-in-polygon test.
 */
function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Determine strip orientation so the band extends inside the polygon.
 * Tests a point offset perpendicular to the first segment with orientation=1.
 * If that point is inside the polygon, orientation=1 is correct; else -1.
 */
function computeStripOrientationInside(chain, polygon) {
  if (chain.length < 2) return 1;
  const mid = {
    x: (chain[0].x + chain[1].x) / 2,
    y: (chain[0].y + chain[1].y) / 2,
  };
  const dx = chain[1].x - chain[0].x;
  const dy = chain[1].y - chain[0].y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 1;
  // perpendicular for orientation=1 (left side): (-dy, dx)
  const testPt = {
    x: mid.x + (-dy / len) * STRIP_TEST_OFFSET,
    y: mid.y + (dx / len) * STRIP_TEST_OFFSET,
  };
  return isPointInPolygon(testPt, polygon) ? 1 : -1;
}

//
// ---------------------------------------------------------------------------

/**
 * Forward index distance from i to j on a ring of size N.
 * Always positive: how many steps forward from i to reach j.
 */
function forwardDist(i, j, N) {
  return (j - i + N) % N;
}

/**
 * Circular index distance (shortest path), accounting for wrap-around.
 */
function indexDist(i, j, N) {
  const d = Math.abs(i - j);
  return Math.min(d, N - d);
}

/**
 * Project point P onto segment [A, B].
 * Returns { dist, t, projPt } where t is the parameter (0-1) and dist is
 * the perpendicular distance. Returns null if projection falls outside segment.
 */
function projectOntoSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return null;

  const t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  if (t < 0 || t > 1) return null;

  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return {
    dist: Math.hypot(px - projX, py - projY),
    t,
    projPt: { x: projX, y: projY },
  };
}

/**
 * Determine if a cut represents an interior element (wall or pillar opening)
 * rather than a room-sized hole. Interior cuts produce VI contours, while
 * room cuts produce VCT contours.
 *
 * A cut is "interior" if:
 * - Its bounding box smallest dimension is ≤ INTERIOR_CUT_MAX_M, OR
 * - It has exactly 4 points forming 3 near-orthogonal consecutive segments
 *   where the middle segment is ≤ INTERIOR_CUT_MAX_M (narrow passage shape).
 *
 * @param {Array<{x,y}>} cutPoints - the cut ring vertices
 * @param {number} meterByPx - scale factor
 * @returns {boolean}
 */
export function isInteriorCut(cutPoints, meterByPx) {
  if (!cutPoints || cutPoints.length < 3 || meterByPx <= 0) return false;

  const thresholdPx = INTERIOR_CUT_MAX_M / meterByPx;

  // Check 1: bounding box smallest dimension ≤ threshold
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of cutPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const bboxMin = Math.min(maxX - minX, maxY - minY);
  if (bboxMin <= thresholdPx) return true;

  // Check 2: 4-point shape with a narrow middle segment (wall/passage shape)
  const N = cutPoints.length;
  if (N >= 3) {
    for (let i = 0; i < N; i++) {
      const a = cutPoints[i];
      const b = cutPoints[(i + 1) % N];
      const c = cutPoints[(i + 2) % N];
      const d = cutPoints[(i + 3) % N];

      const seg1 = { x: b.x - a.x, y: b.y - a.y };
      const seg2 = { x: c.x - b.x, y: c.y - b.y };
      const seg3 = { x: d.x - c.x, y: d.y - c.y };

      const len2 = Math.hypot(seg2.x, seg2.y);
      if (len2 > thresholdPx) continue;

      // Check near-orthogonality: |dot| / (len1 * len2) < 0.2
      const len1 = Math.hypot(seg1.x, seg1.y);
      const len3 = Math.hypot(seg3.x, seg3.y);
      if (len1 < 1e-6 || len2 < 1e-6 || len3 < 1e-6) continue;

      const dot12 = Math.abs(seg1.x * seg2.x + seg1.y * seg2.y) / (len1 * len2);
      const dot23 = Math.abs(seg2.x * seg3.x + seg2.y * seg3.y) / (len2 * len3);

      if (dot12 < 0.2 && dot23 < 0.2) return true;
    }
  }

  return false;
}

/**
 * Clamped point-to-segment distance.
 * Unlike projectOntoSegment, always returns a distance (clamps t to [0,1]).
 */
function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Collect all edge segments from polygons other than polygons[currentIndex].
 * Includes outer ring edges and cut ring edges.
 * @returns {Array<{ax: number, ay: number, bx: number, by: number}>}
 */
function buildForeignEdges(polygons, currentIndex) {
  const edges = [];
  for (let j = 0; j < polygons.length; j++) {
    if (j === currentIndex) continue;
    const poly = polygons[j];

    // outer ring edges
    const pts = poly.points;
    if (pts?.length >= 3) {
      for (let i = 0; i < pts.length; i++) {
        const next = (i + 1) % pts.length;
        edges.push({
          ax: pts[i].x, ay: pts[i].y, idA: pts[i].id,
          bx: pts[next].x, by: pts[next].y, idB: pts[next].id,
        });
      }
    }

    // cut edges
    if (poly.cuts?.length) {
      for (const cut of poly.cuts) {
        const cpts = cut.points;
        if (!cpts?.length || cpts.length < 3) continue;
        for (let i = 0; i < cpts.length; i++) {
          const next = (i + 1) % cpts.length;
          edges.push({
            ax: cpts[i].x, ay: cpts[i].y, idA: cpts[i].id,
            bx: cpts[next].x, by: cpts[next].y, idB: cpts[next].id,
          });
        }
      }
    }
  }
  return edges;
}

/**
 * Compute twice the signed area of a ring (shoelace formula).
 * In screen coordinates (y-down): positive → clockwise, negative → counter-clockwise.
 */
function signedArea2(points) {
  let s = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return s;
}

/**
 * Test whether a point is inside a polygon (outer ring minus cuts).
 */
function isPointInsidePolygonWithCuts(point, polygon) {
  if (!isPointInPolygon(point, polygon.points)) return false;
  if (polygon.cuts) {
    for (const cut of polygon.cuts) {
      if (cut.points && isPointInPolygon(point, cut.points)) return false;
    }
  }
  return true;
}

/**
 * Test whether a point is inside any of the foreign polygons.
 */
function isPointInsideAnyForeignPolygon(point, foreignPolygons) {
  for (const poly of foreignPolygons) {
    if (isPointInsidePolygonWithCuts(point, poly)) return true;
  }
  return false;
}

/**
 * Collect unique foreign vertices from the foreign edge set,
 * preserving their original IDs when available.
 */
function collectForeignVertices(foreignEdges) {
  const seen = new Set();
  const vertices = [];
  for (const e of foreignEdges) {
    const kA = `${e.ax},${e.ay}`;
    if (!seen.has(kA)) { seen.add(kA); vertices.push({ x: e.ax, y: e.ay, id: e.idA }); }
    const kB = `${e.bx},${e.by}`;
    if (!seen.has(kB)) { seen.add(kB); vertices.push({ x: e.bx, y: e.by, id: e.idB }); }
  }
  return vertices;
}

/**
 * Subdivide an open chain by projecting foreign vertices onto its segments.
 * For each foreign vertex within detectionPx, its projection point is
 * inserted into the chain, splitting long segments into sub-segments
 * that can then be properly classified by proximity.
 */
const SUBDIV_DEDUP_PX = 1; // skip projected points closer than 1px to an existing vertex

function subdivideChainByForeignProjections(chain, foreignEdges, detectionPx) {
  if (chain.length < 2 || foreignEdges.length === 0) return chain;

  const foreignVertices = collectForeignVertices(foreignEdges);
  const result = [chain[0]];

  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];

    const projections = [];
    for (const fv of foreignVertices) {
      const proj = projectOntoSegment(fv.x, fv.y, a.x, a.y, b.x, b.y);
      if (!proj || proj.dist > detectionPx) continue;
      // Skip projections too close to segment endpoints (distance-based)
      if (Math.hypot(proj.projPt.x - a.x, proj.projPt.y - a.y) < SUBDIV_DEDUP_PX) continue;
      if (Math.hypot(proj.projPt.x - b.x, proj.projPt.y - b.y) < SUBDIV_DEDUP_PX) continue;
      projections.push(proj);
    }

    projections.sort((a, b) => a.t - b.t);

    // Deduplicate close projections (both by t and by distance)
    let lastPt = a;
    for (let j = 0; j < projections.length; j++) {
      const pp = projections[j].projPt;
      if (Math.hypot(pp.x - lastPt.x, pp.y - lastPt.y) < SUBDIV_DEDUP_PX) continue;
      const newPt = { x: pp.x, y: pp.y };
      result.push(newPt);
      lastPt = newPt;
    }

    result.push(b);
  }

  return result;
}

/**
 * Subdivide a closed ring by projecting foreign vertices onto its segments.
 * Same as subdivideChainByForeignProjections but handles the closing segment.
 */
function subdivideRingByForeignProjections(ringPoints, foreignEdges, detectionPx) {
  if (ringPoints.length < 3 || foreignEdges.length === 0) return ringPoints;

  const foreignVertices = collectForeignVertices(foreignEdges);
  const N = ringPoints.length;
  const result = [];

  for (let i = 0; i < N; i++) {
    const a = ringPoints[i];
    const b = ringPoints[(i + 1) % N];

    result.push(a);

    const projections = [];
    for (const fv of foreignVertices) {
      const proj = projectOntoSegment(fv.x, fv.y, a.x, a.y, b.x, b.y);
      if (!proj || proj.dist > detectionPx) continue;
      if (Math.hypot(proj.projPt.x - a.x, proj.projPt.y - a.y) < SUBDIV_DEDUP_PX) continue;
      if (Math.hypot(proj.projPt.x - b.x, proj.projPt.y - b.y) < SUBDIV_DEDUP_PX) continue;
      projections.push(proj);
    }

    projections.sort((a, b) => a.t - b.t);

    let lastPt = a;
    for (let j = 0; j < projections.length; j++) {
      const pp = projections[j].projPt;
      if (Math.hypot(pp.x - lastPt.x, pp.y - lastPt.y) < SUBDIV_DEDUP_PX) continue;
      const newPt = { x: pp.x, y: pp.y };
      result.push(newPt);
      lastPt = newPt;
    }
  }

  return result;
}

/**
 * Test whether both endpoints of a segment are within detectionPx
 * of the foreign edge set.
 */
function isSegmentCloseToForeignEdges(p1x, p1y, p2x, p2y, foreignEdges, detectionPx) {
  let minD1 = Infinity;
  let minD2 = Infinity;
  for (const e of foreignEdges) {
    minD1 = Math.min(minD1, distPointToSegment(p1x, p1y, e.ax, e.ay, e.bx, e.by));
    minD2 = Math.min(minD2, distPointToSegment(p2x, p2y, e.ax, e.ay, e.bx, e.by));
    if (minD1 <= detectionPx && minD2 <= detectionPx) return true;
  }
  return false;
}

/**
 * Clamped projection returning the projected point coordinates.
 */
function clampedProjection(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return { x: ax + t * abx, y: ay + t * aby };
}

/**
 * Test whether a segment should be classified as interior (shared boundary).
 *
 * Both endpoints must be close to foreign edges AND at least one close
 * foreign edge must lie in the outward direction from the segment midpoint.
 * This directional check ensures that:
 * - Segments with a foreign edge on their exterior side → INT (shared wall)
 * - Segments with foreign edges only to the side or inward → EXT
 *
 * @param {number} outwardSign  +1 if the ring is CW in screen coords
 *   (outward = right normal), -1 if CCW (outward = left normal).
 *   For cut rings, pass the FLIPPED sign so the test direction points
 *   into the hole rather than into the parent polygon's solid area.
 */
function isSegmentInterior(p1x, p1y, p2x, p2y, outwardSign, foreignEdges, foreignPolygons, detectionPx) {
  if (!isSegmentCloseToForeignEdges(p1x, p1y, p2x, p2y, foreignEdges, detectionPx)) {
    return false;
  }

  const midX = (p1x + p2x) / 2;
  const midY = (p1y + p2y) / 2;
  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return false;

  // Outward normal: outwardSign=+1 → right normal (dy, -dx); -1 → left normal
  const nx = outwardSign * dy / len;
  const ny = outwardSign * (-dx) / len;

  // Check if any foreign edge within detectionPx of the midpoint lies
  // in the outward direction (positive dot product with outward normal).
  for (const e of foreignEdges) {
    const dist = distPointToSegment(midX, midY, e.ax, e.ay, e.bx, e.by);
    if (dist > detectionPx) continue;

    // Vector from midpoint to its projection on the foreign edge
    const proj = clampedProjection(midX, midY, e.ax, e.ay, e.bx, e.by);
    const vx = proj.x - midX;
    const vy = proj.y - midY;

    // Foreign edge is in the outward direction?
    if (vx * nx + vy * ny > 1e-6) return true;
  }

  return false;
}

/**
 * Split a chain of points into ext/int sub-chains based on proximity
 * to foreign polygon edges. Before classifying, foreign polygon vertices
 * are projected onto the chain segments to insert split points, ensuring
 * long segments that are only partially close get properly subdivided.
 *
 * A segment is "interior" only if both endpoints are close to a foreign
 * edge AND the segment midpoint lies inside a foreign polygon.
 *
 * @param {Array<{x,y,id}>} chain - open polyline chain
 * @param {Array<{ax,ay,bx,by}>} foreignEdges
 * @param {Array} foreignPolygons - polygon objects with {points, cuts}
 * @param {number} outwardSign - +1 for CW rings, -1 for CCW (determines outward normal)
 * @param {number} detectionPx
 * @returns {{ extChains: Array<Array<{x,y,id}>>, intChains: Array<Array<{x,y,id}>> }}
 */
function splitChainByProximity(chain, foreignEdges, foreignPolygons, outwardSign, detectionPx) {
  if (chain.length < 2) return { extChains: [chain], intChains: [] };

  // Subdivide chain at foreign vertex projections before classifying
  const subdivided = subdivideChainByForeignProjections(chain, foreignEdges, detectionPx);

  const close = [];
  for (let i = 0; i < subdivided.length - 1; i++) {
    const p1 = subdivided[i];
    const p2 = subdivided[i + 1];
    close.push(isSegmentInterior(p1.x, p1.y, p2.x, p2.y, outwardSign, foreignEdges, foreignPolygons, detectionPx));
  }

  // check if all same classification → no split needed
  const allClose = close.every(Boolean);
  const allFar = close.every((c) => !c);
  if (allClose) return { extChains: [], intChains: [subdivided] };
  if (allFar) return { extChains: [subdivided], intChains: [] };

  const extChains = [];
  const intChains = [];
  let runStart = 0;

  while (runStart < close.length) {
    const isClose = close[runStart];
    let runEnd = runStart;
    while (runEnd + 1 < close.length && close[runEnd + 1] === isClose) {
      runEnd++;
    }

    // sub-chain includes both boundary points (shared with adjacent runs)
    const subChain = subdivided.slice(runStart, runEnd + 2);

    if (isClose) {
      intChains.push(subChain);
    } else {
      extChains.push(subChain);
    }

    runStart = runEnd + 1;
  }

  return { extChains, intChains };
}

/**
 * Post-classification pass: reclassify exterior chain segments that are
 * close to foreign polygon edges as interior (wall) chains.
 *
 * @param {Array<Array<{x,y,id}>>} exteriorChains
 * @param {Array<Array<{x,y,id}>>} wallChains
 * @param {Array<{ax,ay,bx,by}>} foreignEdges
 * @param {Array} foreignPolygons - polygon objects with {points, cuts}
 * @param {number} outwardSign - +1 for CW rings, -1 for CCW
 * @param {number} detectionPx
 * @returns {{ exteriorChains: Array<Array<{x,y,id}>>, wallChains: Array<Array<{x,y,id}>> }}
 */
function reclassifyExteriorAgainstNeighbors(exteriorChains, wallChains, foreignEdges, foreignPolygons, outwardSign, detectionPx) {
  const newExt = [];
  const newWall = [...wallChains];

  for (const chain of exteriorChains) {
    const { extChains, intChains } = splitChainByProximity(chain, foreignEdges, foreignPolygons, outwardSign, detectionPx);
    newExt.push(...extChains);
    newWall.push(...intChains);
  }

  return { exteriorChains: newExt, wallChains: newWall };
}

/**
 * Reclassify a closed cut ring against foreign polygon edges.
 * Segments close to foreign edges stay as int (VI), segments far
 * from foreign edges become ext (VCT).
 *
 * @param {Array<{x,y,id}>} cutPoints - closed ring points (last != first)
 * @param {Array<{ax,ay,bx,by}>} foreignEdges
 * @param {number} detectionPx
 * @returns {{ extChains: Array<Array<{x,y,id}>>, intChains: Array<Array<{x,y,id}>> }}
 */
function reclassifyCutAgainstNeighbors(cutPoints, foreignEdges, foreignPolygons, detectionPx) {
  if (cutPoints.length < 3) return { extChains: [], intChains: [cutPoints] };

  // Subdivide the ring at foreign vertex projections before classifying.
  const ring = subdivideRingByForeignProjections(cutPoints, foreignEdges, detectionPx);
  const N = ring.length;

  // For cuts, the outward normal of the ring points toward the parent polygon's
  // solid area. We need to test the OPPOSITE direction (into the hole) to see if
  // a foreign polygon is there. So we flip the sign.
  const cutWinding = signedArea2(ring) >= 0 ? 1 : -1; // ring's own outward sign
  const outwardSign = -cutWinding; // flip: test the hole-interior side

  // classify each edge of the closed ring
  const close = [];
  for (let i = 0; i < N; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % N];
    close.push(isSegmentInterior(p1.x, p1.y, p2.x, p2.y, outwardSign, foreignEdges, foreignPolygons, detectionPx));
  }

  const allClose = close.every(Boolean);
  const allFar = close.every((c) => !c);
  if (allClose) return { extChains: [], intChains: [ring] };
  if (allFar) return { extChains: [ring], intChains: [] };

  // Find first transition to start the walk (avoids splitting a run in the middle)
  let startEdge = 0;
  for (let i = 0; i < N; i++) {
    if (close[i] !== close[(i + 1) % N]) {
      startEdge = (i + 1) % N;
      break;
    }
  }

  const extChains = [];
  const intChains = [];
  let visited = 0;

  while (visited < N) {
    const edgeIdx = (startEdge + visited) % N;
    const isClose = close[edgeIdx];

    // collect consecutive edges of same type
    const runPoints = [ring[edgeIdx]];
    let count = 0;
    while (visited + count < N) {
      const ei = (startEdge + visited + count) % N;
      if (close[ei] !== isClose) break;
      runPoints.push(ring[(ei + 1) % N]);
      count++;
    }

    if (isClose) {
      intChains.push(runPoints);
    } else {
      extChains.push(runPoints);
    }

    visited += count;
  }

  return { extChains, intChains };
}

// ---------------------------------------------------------------------------
// Contour classification (isolated, testable function)
// ---------------------------------------------------------------------------

/**
 * Scan a ring in one direction, detecting wall branch pairs.
 *
 * Walks from a convex-hull start point. At each point, scans ahead for
 * a non-adjacent close match (point-to-point or projection ≤ detectionPx).
 *
 * @returns {Array<{
 *   entryIdx: number,
 *   exitIdx: number,
 *   exitProjPt: {x,y}|null,
 *   exitContinueIdx: number,
 *   intIndices: Set<number>
 * }>}
 */
function scanForBranches(points, N, detectionPx) {
  // start from leftmost point (on convex hull = guaranteed exterior)
  let startIdx = 0;
  for (let i = 1; i < N; i++) {
    if (
      points[i].x < points[startIdx].x ||
      (points[i].x === points[startIdx].x && points[i].y < points[startIdx].y)
    ) {
      startIdx = i;
    }
  }

  const branches = [];
  let visited = 0;
  let cursor = startIdx;

  while (visited < N) {
    const ci = cursor;
    const pt = points[ci];
    const remaining = N - visited - 1;

    let match = null;
    if (remaining >= MIN_INDEX_DISTANCE) {
      for (let fwd = MIN_INDEX_DISTANCE; fwd <= remaining; fwd++) {
        const j = (ci + fwd) % N;

        // 1. point-to-point
        if (Math.hypot(pt.x - points[j].x, pt.y - points[j].y) <= detectionPx) {
          match = { type: "point", targetIdx: j, fwd };
          break;
        }

        // 2. projection onto segment [j, j+1]
        if (fwd + 1 > remaining) continue;
        const jn = (j + 1) % N;
        const proj = projectOntoSegment(
          pt.x, pt.y,
          points[j].x, points[j].y,
          points[jn].x, points[jn].y
        );
        if (proj && proj.dist <= detectionPx) {
          match = { type: "projection", segStartIdx: j, segEndIdx: jn, projPt: proj.projPt, fwd };
          break;
        }
      }
    }

    if (match) {
      // Collect int vertex indices
      const intIndices = new Set();
      intIndices.add(ci); // green

      if (match.type === "point") {
        let w = (ci + 1) % N;
        while (w !== match.targetIdx) {
          intIndices.add(w);
          w = (w + 1) % N;
        }
        intIndices.add(match.targetIdx); // pink

        branches.push({
          entryIdx: ci,
          exitIdx: match.targetIdx,
          exitProjPt: null,
          exitContinueIdx: (match.targetIdx + 1) % N,
          intIndices,
        });

        visited += forwardDist(ci, match.targetIdx, N) + 1;
        cursor = (match.targetIdx + 1) % N;
      } else {
        let w = (ci + 1) % N;
        while (w !== match.segEndIdx) {
          intIndices.add(w);
          w = (w + 1) % N;
        }

        branches.push({
          entryIdx: ci,
          exitIdx: match.segStartIdx,
          exitProjPt: match.projPt,
          exitContinueIdx: match.segEndIdx,
          intIndices,
        });

        visited += forwardDist(ci, match.segStartIdx, N) + 1;
        cursor = match.segEndIdx;
      }
    } else {
      visited++;
      cursor = (ci + 1) % N;
    }
  }

  return branches;
}

/**
 * Convert a branch detected on a reversed ring to original ring indices.
 * Backward entry → forward exit, backward exit → forward entry.
 */
function convertReversedBranch(revBranch, N) {
  const origIntIndices = new Set();
  for (const idx of revBranch.intIndices) {
    origIntIndices.add(N - 1 - idx);
  }

  // Forward exit = reversed entry (green), forward entry = reversed exit (pink)
  const origExitIdx = N - 1 - revBranch.entryIdx;

  if (revBranch.exitProjPt) {
    // Projection at reversed exit → projection at forward entry
    const origEntryIdx = N - 1 - revBranch.exitIdx;
    return {
      entryIdx: origEntryIdx,
      entryProjPt: revBranch.exitProjPt,
      entryPrevIdx: (origEntryIdx - 1 + N) % N,
      exitIdx: origExitIdx,
      exitProjPt: null,
      exitContinueIdx: (origExitIdx + 1) % N,
      intIndices: origIntIndices,
    };
  }

  // Point-to-point: swap entry/exit
  const origEntryIdx = N - 1 - revBranch.exitIdx;
  return {
    entryIdx: origEntryIdx,
    entryProjPt: null,
    entryPrevIdx: null,
    exitIdx: origExitIdx,
    exitProjPt: null,
    exitContinueIdx: (origExitIdx + 1) % N,
    intIndices: origIntIndices,
  };
}

/**
 * Build ext/int chains from a sorted list of branches.
 */
function buildChainsFromBranches(points, N, branches, startIdx) {
  const extChains = [];
  const intChains = [];
  let currentExt = [];
  let cursor = startIdx;

  for (const branch of branches) {
    const walkTo = branch.entryProjPt ? branch.entryPrevIdx : branch.entryIdx;

    // Walk ext from cursor to walkTo
    while (cursor !== walkTo) {
      currentExt.push(points[cursor].id);
      cursor = (cursor + 1) % N;
    }
    currentExt.push(points[walkTo].id);

    if (branch.entryProjPt) {
      // Add projected green point (shared)
      currentExt.push(branch.entryProjPt);
    }
    if (currentExt.length >= 2) extChains.push(currentExt);

    // Int chain
    const intChain = [];
    if (branch.entryProjPt) {
      intChain.push(branch.entryProjPt);
    }
    intChain.push(points[branch.entryIdx].id);
    let w = (branch.entryIdx + 1) % N;
    while (w !== branch.exitIdx) {
      intChain.push(points[w].id);
      w = (w + 1) % N;
    }
    intChain.push(points[branch.exitIdx].id);
    if (branch.exitProjPt) {
      intChain.push(branch.exitProjPt);
    }
    intChains.push(intChain);

    // Start new ext from exit
    currentExt = branch.exitProjPt ? [branch.exitProjPt] : [points[branch.exitIdx].id];
    cursor = branch.exitContinueIdx;
  }

  // Close the ring: walk back to startIdx
  while (cursor !== startIdx) {
    currentExt.push(points[cursor].id);
    cursor = (cursor + 1) % N;
  }
  currentExt.push(points[startIdx].id);

  if (extChains.length > 0) {
    extChains[0] = [...currentExt.slice(0, -1), ...extChains[0]];
  } else if (currentExt.length >= 2) {
    extChains.push(currentExt);
  }

  return { ext: extChains, int: intChains };
}

/**
 * Classify the vertices of a closed polygon outer ring into exterior
 * and int/ext (wall branch) contour chains.
 *
 * Runs the branch detection in both ring directions (forward and backward)
 * to catch projection-based matches that are direction-dependent, then
 * merges the results.
 *
 * @param {Array<{x: number, y: number, id: string}>} points - ring in px coords
 * @param {number} meterByPx - scale factor (meters per pixel)
 * @returns {{ ext: string[][], int: string[][] }}
 *   ext: array of exterior polyline chains (each is an array of point IDs)
 *   int: array of int/ext wall branch chains (each is an array of point IDs)
 *   Transition points (green/pink) are shared between ext and int chains.
 */
export function classifyRingContours(points, meterByPx) {
  const N = points.length;
  if (N < 3) return { ext: [points.map((p) => p.id)], int: [] };

  const detectionPx = WALL_DETECTION_M / meterByPx;

  // Start from leftmost point (on convex hull = guaranteed exterior)
  let startIdx = 0;
  for (let i = 1; i < N; i++) {
    if (
      points[i].x < points[startIdx].x ||
      (points[i].x === points[startIdx].x && points[i].y < points[startIdx].y)
    ) {
      startIdx = i;
    }
  }

  // Pass 1: forward scan
  const fwdBranches = scanForBranches(points, N, detectionPx);
  // Normalize: forward branches already have correct entry/exit
  for (const b of fwdBranches) {
    b.entryProjPt = null;
    b.entryPrevIdx = null;
  }

  // Pass 2: backward scan (reverse the ring, run same scan, convert back)
  const revPoints = [...points].reverse();
  const bwdBranchesRev = scanForBranches(revPoints, N, detectionPx);
  const bwdBranches = bwdBranchesRev.map((b) => convertReversedBranch(b, N));

  // Merge: keep all forward branches, add backward branches that don't overlap
  const merged = [...fwdBranches];
  for (const bwd of bwdBranches) {
    const overlaps = merged.some((m) => {
      for (const idx of bwd.intIndices) {
        if (m.intIndices.has(idx)) return true;
      }
      return false;
    });
    if (!overlaps) merged.push(bwd);
  }

  if (merged.length === 0) {
    return { ext: [points.map((p) => p.id)], int: [] };
  }

  // Sort by forward distance from startIdx
  merged.sort(
    (a, b) => forwardDist(startIdx, a.entryIdx, N) - forwardDist(startIdx, b.entryIdx, N)
  );

  return buildChainsFromBranches(points, N, merged, startIdx);
}

// ---------------------------------------------------------------------------
// Contour extraction (convenience wrapper)
// ---------------------------------------------------------------------------

/**
 * Extract exterior and wall-branch contour point arrays from a polygon ring.
 * When foreignEdges is provided, exterior segments close to foreign polygons
 * are reclassified as interior (wall) chains.
 * Returns { exteriorChains: Point[][], wallChains: Point[][] }
 */
function extractContours(points, meterByPx, foreignEdges = [], foreignPolygons = []) {
  const { ext, int } = classifyRingContours(points, meterByPx);

  // resolve IDs back to point objects
  const byId = {};
  for (const pt of points) byId[pt.id] = pt;

  function resolveChain(chain) {
    return chain.map((entry) =>
      typeof entry === "string" ? byId[entry] : entry
    );
  }

  let exteriorChains = ext.map(resolveChain);
  let wallChains = int.map(resolveChain);

  if (foreignEdges.length > 0) {
    const detectionPx = WALL_DETECTION_M / meterByPx;

    // When no branches were detected, classifyRingContours returns a single
    // ext chain [a, b, c, d] without the closing point.  We must close the
    // ring explicitly so splitChainByProximity sees ALL edges (including d→a).
    const isClosedRing = ext.length === 1 && int.length === 0;
    if (isClosedRing && exteriorChains[0].length >= 3) {
      exteriorChains[0] = [...exteriorChains[0], exteriorChains[0][0]];
    }

    // Determine outward sign from the outer ring winding direction.
    // In screen coords (y-down): signedArea2 > 0 → CW → outward = right normal (+1).
    const outwardSign = signedArea2(points) >= 0 ? 1 : -1;

    ({ exteriorChains, wallChains } = reclassifyExteriorAgainstNeighbors(
      exteriorChains, wallChains, foreignEdges, foreignPolygons, outwardSign, detectionPx
    ));
  }

  return { exteriorChains, wallChains };
}

// ---------------------------------------------------------------------------
// Output builders
// ---------------------------------------------------------------------------

function createPointRecord(pt, imageSize, context) {
  return {
    id: nanoid(),
    x: pt.x / imageSize.width,
    y: pt.y / imageSize.height,
    baseMapId: context.baseMapId,
    projectId: context.projectId,
    listingId: context.targetListingId,
  };
}

function buildRels(annotationId, template, context) {
  const categories = template.mappingCategories ?? [];
  return categories.map((cat) => {
    const [nomenclatureKey, categoryKey] = cat.split(":");
    return {
      id: nanoid(),
      annotationId,
      projectId: context.projectId,
      nomenclatureKey,
      categoryKey,
      source: "annotationTemplate",
    };
  });
}

/**
 * Remove intermediate points that are colinear with their neighbors.
 * Projected subdivision points that don't serve as ext/int transition
 * points are unnecessary and clutter the output.
 */
const COLINEAR_TOLERANCE_PX = 0.5;

function removeColinearPoints(chain) {
  if (chain.length <= 2) return chain;
  const result = [chain[0]];
  for (let i = 1; i < chain.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = chain[i];
    const next = chain[i + 1];
    // Perpendicular distance from curr to line (prev → next)
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) { result.push(curr); continue; }
    const dist = Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / len;
    if (dist > COLINEAR_TOLERANCE_PX) {
      result.push(curr);
    }
  }
  result.push(chain[chain.length - 1]);
  return result;
}

/**
 * Create a POLYLINE annotation from a chain of points.
 * Transition points between ext/int chains share the same JS object
 * reference (from array slice), so _outputPointId ensures they get
 * the same DB point ID across annotations.
 */
function buildPolylineAnnotation(
  chain,
  template,
  height,
  imageSize,
  context,
  outputPoints
) {
  // Remove colinear subdivision points that don't serve as transitions
  const cleanChain = removeColinearPoints(chain);

  // Skip degenerate chains (zero-length polylines from ext/int split artifacts)
  let totalLen = 0;
  for (let i = 0; i < cleanChain.length - 1; i++) {
    totalLen += Math.hypot(cleanChain[i + 1].x - cleanChain[i].x, cleanChain[i + 1].y - cleanChain[i].y);
  }
  if (totalLen < 0.5) return null;

  const pointRefs = cleanChain.map((pt) => {
    // Intra-polygon sharing: transition points between ext/int chains
    // are the same JS object (from array slice). Reuse the ID assigned
    // by the first annotation that processed this point.
    if (pt._outputPointId) {
      return { id: pt._outputPointId };
    }
    const rec = createPointRecord(pt, imageSize, context);
    outputPoints.push(rec);
    pt._outputPointId = rec.id;
    return { id: rec.id };
  });

  const annotationId = nanoid();
  const annotation = {
    id: annotationId,
    projectId: context.projectId,
    baseMapId: context.baseMapId,
    listingId: context.targetListingId,
    annotationTemplateId: template.id,
    type: "POLYLINE",
    points: pointRefs,
    height: height ?? null,
    ...(context.activeLayerId ? { layerId: context.activeLayerId } : {}),
  };

  const rels = buildRels(annotationId, template, context);
  return { annotation, rels };
}

// ---------------------------------------------------------------------------
// Main procedure
// ---------------------------------------------------------------------------

/**
 * FROM POLYGON TO BIM procedure.
 *
 * For each source polygon annotation, identifies contour types
 * (exterior, int/ext wall branches, interior cuts) and generates
 * BIM annotations. Templates are resolved per-polygon from the
 * polygon's own listing:
 *
 * - OUVRAGE:VCT  → polylines from exterior contour (with height)
 * - OUVRAGE:VI   → polylines from int/ext + interior contours
 */
export default function fromPolygonsToBim({
  sourceAnnotations,
  templatesByListingId,
  imageSize,
  meterByPx,
  context,
}) {
  const height = context.height ? parseFloat(context.height) : null;

  const outputAnnotations = [];
  const outputPoints = [];
  const outputRels = [];

  // Shared point map: when a foreign vertex is projected onto a contour,
  // the projected point is shared between adjacent polygon annotations.
  // Key = source vertex ID, value = created point record ID.

  const polygons = sourceAnnotations.filter((a) => a.type === "POLYGON");

  // Build a set of FOSSE template IDs so we can identify FOSSE polygons.
  // FOSSE polygons participate in foreign edge detection (ext→int transitions)
  // but do not generate VCT/VI/cuts annotations themselves.
  const fosseTemplateIds = new Set();
  for (const [, templates] of templatesByListingId) {
    const fosseT = matchAnnotationTemplate(templates, ["OUVRAGE:FOSSE"]);
    if (fosseT) fosseTemplateIds.add(fosseT.id);
  }

  for (let pi = 0; pi < polygons.length; pi++) {
    const polygon = polygons[pi];
    const outerPoints = polygon.points;
    if (!outerPoints?.length || outerPoints.length < 3) continue;

    // FOSSE polygons only serve as foreign zones for neighbor detection
    const isFosse = fosseTemplateIds.has(polygon.annotationTemplateId);
    if (isFosse) continue;

    // resolve templates from the polygon's own listing
    const polygonListingId = polygon.listingId;
    const polygonTemplates = templatesByListingId.get(polygonListingId) ?? [];
    const vctTemplate = matchAnnotationTemplate(polygonTemplates, ["OUVRAGE:VCT"]);
    const viTemplate = matchAnnotationTemplate(polygonTemplates, ["OUVRAGE:VI"]);
    const polyCtx = { ...context, targetListingId: polygonListingId };

    // build foreign edges and polygons from all other polygons for neighbor detection
    const foreignEdges = buildForeignEdges(polygons, pi);
    const foreignPolygons = polygons.filter((_, j) => j !== pi);

    // extract exterior and wall branch contours by walking the ring
    const { exteriorChains, wallChains } = extractContours(
      outerPoints,
      meterByPx,
      foreignEdges,
      foreignPolygons
    );

    // --- 1. VCT: exterior contour polylines with height ---
    if (vctTemplate) {
      for (const chain of exteriorChains) {
        if (chain.length < 2) continue;
        const result = buildPolylineAnnotation(
          chain,
          vctTemplate,
          height,
          imageSize,
          polyCtx,
          outputPoints
        );
        if (result) {
          outputAnnotations.push(result.annotation);
          outputRels.push(...result.rels);
        }
      }
    }

    // --- 2. VI: int/ext wall branch polylines + interior contour polylines ---
    if (viTemplate) {
      for (const chain of wallChains) {
        if (chain.length < 2) continue;
        const result = buildPolylineAnnotation(
          chain,
          viTemplate,
          null,
          imageSize,
          polyCtx,
          outputPoints
        );
        if (result) {
          outputAnnotations.push(result.annotation);
          outputRels.push(...result.rels);
        }
      }
    }

    // --- 2b. Cuts: classify as VCT (room hole) or VI (wall/pillar) ---
    if (polygon.cuts?.length) {
      const detectionPx = meterByPx > 0 ? WALL_DETECTION_M / meterByPx : 0;

      for (const cut of polygon.cuts) {
        if (!cut.points?.length || cut.points.length < 3) continue;

        // Interior cuts (walls, pillars) → always VI regardless of neighbors
        if (isInteriorCut(cut.points, meterByPx) && viTemplate) {
          const r = buildPolylineAnnotation(
            cut.points, viTemplate, null, imageSize, polyCtx, outputPoints
          );
          if (r) {
            r.annotation.closeLine = true;
            outputAnnotations.push(r.annotation);
            outputRels.push(...r.rels);
          }
          continue;
        }

        // Room-sized cuts: reclassify against foreign edges if present
        if (foreignEdges.length > 0 && detectionPx > 0 && vctTemplate && viTemplate) {
          const { extChains, intChains } = reclassifyCutAgainstNeighbors(
            cut.points, foreignEdges, foreignPolygons, detectionPx
          );

          for (const chain of extChains) {
            if (chain.length < 2) continue;
            const r = buildPolylineAnnotation(
              chain, vctTemplate, height, imageSize, polyCtx, outputPoints
            );
            if (r) {
              if (extChains.length === 1 && intChains.length === 0) r.annotation.closeLine = true;
              outputAnnotations.push(r.annotation);
              outputRels.push(...r.rels);
            }
          }

          for (const chain of intChains) {
            if (chain.length < 2) continue;
            const r = buildPolylineAnnotation(
              chain, viTemplate, null, imageSize, polyCtx, outputPoints
            );
            if (r) {
              if (intChains.length === 1 && extChains.length === 0) r.annotation.closeLine = true;
              outputAnnotations.push(r.annotation);
              outputRels.push(...r.rels);
            }
          }
        } else if (vctTemplate) {
          const r = buildPolylineAnnotation(
            cut.points, vctTemplate, height, imageSize, polyCtx, outputPoints
          );
          if (r) {
            r.annotation.closeLine = true;
            outputAnnotations.push(r.annotation);
            outputRels.push(...r.rels);
          }
        }
      }
    }

  }

  // --- Build per-listing resolved templates for post-loop steps ---
  const resolvedByListing = new Map();
  for (const [lid, templates] of templatesByListingId) {
    resolvedByListing.set(lid, {
      vctTemplate: matchAnnotationTemplate(templates, ["OUVRAGE:VCT"]),
      viTemplate: matchAnnotationTemplate(templates, ["OUVRAGE:VI"]),
      rtpTemplate: matchAnnotationTemplate(templates, ["OUVRAGE:RTP"]),
      arTemplate: matchAnnotationTemplate(templates, ["OUVRAGE:AR"]),
    });
  }

  // --- 4. Retour technique 1m (split VI ends connected to VCT) ---
  // Runs per listing group so that template IDs match correctly.
  if (context.returnTechnique) {
    for (const [lid, resolved] of resolvedByListing) {
      if (!resolved.vctTemplate || !resolved.viTemplate) continue;
      const listingCtx = { ...context, targetListingId: lid };
      applyRetourTechnique(
        outputAnnotations,
        outputPoints,
        outputRels,
        resolved.vctTemplate,
        resolved.viTemplate,
        meterByPx,
        imageSize,
        listingCtx
      );
    }
  }

  // --- 5. Merge VCT polylines into longest possible chains + RTP strips ---
  // Group by listingId to avoid cross-listing merging.
  for (const [lid, resolved] of resolvedByListing) {
    const { vctTemplate: listingVct, rtpTemplate: listingRtp } = resolved;
    if (!listingRtp || !listingVct) continue;

    const listingCtx = { ...context, targetListingId: lid };

    // collect all VCT annotations for this listing (including retour technique ones)
    const vctAnns = outputAnnotations.filter(
      (a) => a.annotationTemplateId === listingVct.id && a.listingId === lid
    );

    const pointById = {};
    for (const p of outputPoints) pointById[p.id] = p;

    const vctPxChains = vctAnns
      .map((ann) => {
        const pts = ann.points
          .map((ref) => {
            const p = pointById[ref.id];
            return p
              ? { x: p.x * imageSize.width, y: p.y * imageSize.height, id: ref.id }
              : null;
          })
          .filter(Boolean);
        // For closed VCT polylines, append the first point to close the loop
        // so mergePolylines can detect it as a closed chain.
        if (ann.closeLine && pts.length >= 3) {
          pts.push({ ...pts[0] });
        }
        return pts;
      })
      .filter((c) => c.length >= 2);

    if (vctPxChains.length > 0) {
      const merged = mergePolylines(vctPxChains);

      for (const chain of merged) {
        if (chain.length < 2) continue;

        const pointRefs = chain.map((pt) => {
          const rec = createPointRecord(pt, imageSize, listingCtx);
          outputPoints.push(rec);
          return { id: rec.id };
        });

        // strip orientation: find which source polygon's material this VCT
        // chain borders, then orient the strip so the band extends into
        // the material (outer ring minus cuts).
        let stripOrientation = 1;
        if (chain.length >= 2) {
          const mid = {
            x: (chain[0].x + chain[1].x) / 2,
            y: (chain[0].y + chain[1].y) / 2,
          };
          const dx = chain[1].x - chain[0].x;
          const dy = chain[1].y - chain[0].y;
          const len = Math.hypot(dx, dy);
          if (len > 1e-6) {
            const offset = STRIP_TEST_OFFSET;
            const leftPt = { x: mid.x + (-dy / len) * offset, y: mid.y + (dx / len) * offset };
            const rightPt = { x: mid.x + (dy / len) * offset, y: mid.y + (-dx / len) * offset };

            for (const pg of polygons) {
              // Test against material = outer ring MINUS cuts
              const leftInside = isPointInsidePolygonWithCuts(leftPt, pg);
              const rightInside = isPointInsidePolygonWithCuts(rightPt, pg);
              if (leftInside && !rightInside) { stripOrientation = 1; break; }
              if (rightInside && !leftInside) { stripOrientation = -1; break; }
            }
          }
        }

        // Detect if the merged chain forms a closed loop
        const first = chain[0];
        const last = chain[chain.length - 1];
        const isClosed = Math.hypot(first.x - last.x, first.y - last.y) < 1;

        // For closed strips, offsetPolygon interprets the sign as expand/shrink
        // (not left/right like open strips). Room-sized cut rings need expand
        // (+1) because material is OUTSIDE the hole. Interior cuts (walls/pillars)
        // do NOT need the flip — they behave like outer rings.
        if (isClosed) {
          let isRoomHoleRing = false;
          for (const pg of polygons) {
            if (!pg.cuts || isRoomHoleRing) continue;
            for (const cut of pg.cuts) {
              if (!cut.points) continue;
              // Check if chain matches this cut AND the cut is room-sized (not interior)
              const matchesCut = cut.points.some((cp) =>
                Math.hypot(cp.x - first.x, cp.y - first.y) < 2
              );
              if (matchesCut && !isInteriorCut(cut.points, meterByPx)) {
                isRoomHoleRing = true;
                break;
              }
            }
          }
          if (isRoomHoleRing) stripOrientation = -stripOrientation;
        }

        const annotationId = nanoid();
        outputAnnotations.push({
          id: annotationId,
          projectId: context.projectId,
          baseMapId: context.baseMapId,
          listingId: lid,
          annotationTemplateId: listingRtp.id,
          type: "STRIP",
          points: pointRefs,
          height: height ?? null,
          stripOrientation,
          strokeWidth: listingRtp.strokeWidth ?? 20,
          strokeWidthUnit: listingRtp.strokeWidthUnit ?? "CM",
          ...(isClosed && { closeLine: true }),
          ...(context.activeLayerId ? { layerId: context.activeLayerId } : {}),
        });
        outputRels.push(...buildRels(annotationId, listingRtp, listingCtx));
      }
    }
  }

  // --- 6. AR: detect reentrant angles on new polylines vs source polygons ---
  // Collect all VCT/VI template IDs across all listings
  const allVctViTemplateIds = new Set();
  const templateIdToListingId = new Map();
  for (const [lid, resolved] of resolvedByListing) {
    if (resolved.vctTemplate) {
      allVctViTemplateIds.add(resolved.vctTemplate.id);
      templateIdToListingId.set(resolved.vctTemplate.id, lid);
    }
    if (resolved.viTemplate) {
      allVctViTemplateIds.add(resolved.viTemplate.id);
      templateIdToListingId.set(resolved.viTemplate.id, lid);
    }
  }

  if (allVctViTemplateIds.size > 0) {
    const pointById = { ...context._existingPointsPx };
    for (const p of outputPoints) pointById[p.id] = p;

    const newPolylines = outputAnnotations
      .filter(
        (a) =>
          a.type === "POLYLINE" && allVctViTemplateIds.has(a.annotationTemplateId)
      )
      .map((ann) => ({
        id: ann.id,
        listingId: ann.listingId,
        annotationTemplateId: ann.annotationTemplateId,
        points: ann.points
          .map((ref) => {
            const p = pointById[ref.id];
            return p
              ? {
                  x: p.x * imageSize.width,
                  y: p.y * imageSize.height,
                  id: ref.id,
                }
              : null;
          })
          .filter(Boolean),
        height: ann.height,
        closeLine: ann.closeLine ?? false,
      }))
      .filter((pl) => pl.points.length >= 2);

    const pxPolygons = polygons.map((pg) => ({
      id: pg.id ?? nanoid(),
      points: pg.points,
      cuts: pg.cuts,
    }));

    const reentrantAngles = findReentrantAngles({
      polylines: newPolylines,
      polygons: pxPolygons,
    });

    for (const angle of reentrantAngles) {
      // find the source polyline to determine listingId
      const sourcePl = newPolylines.find(
        (pl) => angle.polylineIds?.includes(pl.id)
      );
      const angleLid = sourcePl?.listingId ?? polygons[0]?.listingId;
      if (!angleLid) continue;

      const resolved = resolvedByListing.get(angleLid);
      const arTemplate = resolved?.arTemplate;
      if (!arTemplate) continue;

      const listingCtx = { ...context, targetListingId: angleLid };
      const annotationId = nanoid();
      outputAnnotations.push({
        id: annotationId,
        projectId: context.projectId,
        baseMapId: context.baseMapId,
        listingId: angleLid,
        annotationTemplateId: arTemplate.id,
        type: "POINT",
        point: { id: angle.pointId },
        height: angle.height,
        fillColor: arTemplate.fillColor,
        variant: arTemplate.variant,
        size: arTemplate.size,
        sizeUnit: arTemplate.sizeUnit,
        ...(context.activeLayerId ? { layerId: context.activeLayerId } : {}),
      });
      outputRels.push(...buildRels(annotationId, arTemplate, listingCtx));
    }
  }

  // Deduplicate points by id (the same source point may be referenced
  // by multiple output annotations: VCT, VI, retour technique…)
  const seenPointIds = new Set();
  const uniquePoints = [];
  for (const p of outputPoints) {
    if (!seenPointIds.has(p.id)) {
      seenPointIds.add(p.id);
      uniquePoints.push(p);
    }
  }

  return {
    annotations: outputAnnotations,
    points: uniquePoints,
    rels: outputRels,
  };
}

// ---------------------------------------------------------------------------
// Retour technique 1m
// ---------------------------------------------------------------------------

const RETURN_LENGTH_M = 1;

/**
 * For each VI polyline connected to a VCT polyline, split the first 1m
 * of the VI at each connection and re-assign it to the VCT template.
 *
 * Handles both single-end and double-end (U-shape) connections by computing
 * all splits on the original points before applying any mutation.
 *
 * Works with absolute indices (no array reversal) for clarity.
 *
 * Mutates the output arrays in place.
 */
function applyRetourTechnique(
  annotations,
  points,
  rels,
  vctTemplate,
  viTemplate,
  meterByPx,
  imageSize,
  context
) {
  const returnLengthPx = RETURN_LENGTH_M / meterByPx;

  const pointById = {};
  for (const p of points) pointById[p.id] = p;

  function toPx(ref) {
    const p = pointById[ref.id];
    if (!p) return null;
    return { x: p.x * imageSize.width, y: p.y * imageSize.height };
  }

  /**
   * Walk forward from ptRefs[0], accumulate distance.
   * Returns { splitAfter: index, splitRef } where the split point lies
   * on segment [splitAfter, splitAfter+1].
   * Return portion = ptRefs[0..splitAfter] + splitPt.
   */
  function findSplitFromStart(ptRefs) {
    let cumDist = 0;
    for (let i = 0; i < ptRefs.length - 1; i++) {
      const aPx = toPx(ptRefs[i]);
      const bPx = toPx(ptRefs[i + 1]);
      if (!aPx || !bPx) continue;
      const segLen = Math.hypot(bPx.x - aPx.x, bPx.y - aPx.y);
      if (cumDist + segLen >= returnLengthPx) {
        const t = (returnLengthPx - cumDist) / segLen;
        const a = pointById[ptRefs[i].id];
        const b = pointById[ptRefs[i + 1].id];
        const rec = createPointRecord(
          {
            x: (a.x + t * (b.x - a.x)) * imageSize.width,
            y: (a.y + t * (b.y - a.y)) * imageSize.height,
          },
          imageSize,
          context
        );
        points.push(rec);
        return { splitAfter: i, splitRef: { id: rec.id } };
      }
      cumDist += segLen;
    }
    return null;
  }

  /**
   * Walk backward from ptRefs[last], accumulate distance.
   * Returns { splitBefore: index, splitRef } where the split point lies
   * on segment [splitBefore-1, splitBefore].
   * Return portion = splitPt + ptRefs[splitBefore..last].
   */
  function findSplitFromEnd(ptRefs) {
    let cumDist = 0;
    for (let i = ptRefs.length - 1; i > 0; i--) {
      const aPx = toPx(ptRefs[i]);
      const bPx = toPx(ptRefs[i - 1]);
      if (!aPx || !bPx) continue;
      const segLen = Math.hypot(bPx.x - aPx.x, bPx.y - aPx.y);
      if (cumDist + segLen >= returnLengthPx) {
        const t = (returnLengthPx - cumDist) / segLen;
        const a = pointById[ptRefs[i].id];
        const b = pointById[ptRefs[i - 1].id];
        const rec = createPointRecord(
          {
            x: (a.x + t * (b.x - a.x)) * imageSize.width,
            y: (a.y + t * (b.y - a.y)) * imageSize.height,
          },
          imageSize,
          context
        );
        points.push(rec);
        return { splitBefore: i, splitRef: { id: rec.id } };
      }
      cumDist += segLen;
    }
    return null;
  }

  // collect VCT endpoint IDs (real shared-point junctions only)
  const vctEndpointIds = new Set();
  for (const ann of annotations) {
    if (ann.annotationTemplateId !== vctTemplate.id) continue;
    const pts = ann.points;
    if (pts.length < 2) continue;
    vctEndpointIds.add(pts[0].id);
    vctEndpointIds.add(pts[pts.length - 1].id);
  }

  const newAnnotations = [];
  const newRels = [];

  for (const vi of annotations) {
    if (vi.annotationTemplateId !== viTemplate.id) continue;
    const ptRefs = vi.points;
    if (ptRefs.length < 2) continue;

    const startConnected = vctEndpointIds.has(ptRefs[0].id);
    const endConnected = vctEndpointIds.has(ptRefs[ptRefs.length - 1].id);

    if (!startConnected && !endConnected) continue;

    // compute splits on the ORIGINAL ptRefs before any mutation
    const ss = startConnected ? findSplitFromStart(ptRefs) : null;
    const es = endConnected ? findSplitFromEnd(ptRefs) : null;

    // indices: start return = [0 .. ss.splitAfter] + splitPt
    //          end return   = splitPt + [es.splitBefore .. last]
    //          middle       = splitPt_s + [ss.splitAfter+1 .. es.splitBefore-1] + splitPt_e
    const middleStart = ss ? ss.splitAfter + 1 : 0;
    const middleEnd = es ? es.splitBefore - 1 : ptRefs.length - 1;

    // When middleStart > middleEnd, the two splits fall on the same segment
    // (no original points between them). If both splitRefs exist, the middle
    // is simply [ss.splitRef, es.splitRef]. If only one or neither split
    // succeeded (VI shorter than returnLength), convert the entire VI to VCT.
    if (middleStart > middleEnd) {
      if (ss && es) {
        // Both splits exist — they just land on the same segment.
        // Proceed to build start/end RT below; middle = [ss.splitRef, es.splitRef].
      } else {
        // VI too short for even one split: convert entirely to VCT.
        vi.annotationTemplateId = vctTemplate.id;
        vi.height = vi.height ?? null;
        for (let r = rels.length - 1; r >= 0; r--) {
          if (rels[r].annotationId === vi.id) rels.splice(r, 1);
        }
        rels.push(...buildRels(vi.id, vctTemplate, context));
        continue;
      }
    }

    // build start return VCT
    if (ss) {
      const refs = ptRefs
        .slice(0, ss.splitAfter + 1)
        .map((p) => ({ id: p.id }));
      refs.push(ss.splitRef);

      const retId = nanoid();
      newAnnotations.push({
        id: retId,
        projectId: context.projectId,
        baseMapId: context.baseMapId,
        listingId: context.targetListingId,
        annotationTemplateId: vctTemplate.id,
        type: "POLYLINE",
        points: refs,
        height: vi.height ?? null,
        ...(context.activeLayerId ? { layerId: context.activeLayerId } : {}),
      });
      newRels.push(...buildRels(retId, vctTemplate, context));
    }

    // build end return VCT
    if (es) {
      const refs = [es.splitRef];
      refs.push(
        ...ptRefs.slice(es.splitBefore).map((p) => ({ id: p.id }))
      );

      const retId = nanoid();
      newAnnotations.push({
        id: retId,
        projectId: context.projectId,
        baseMapId: context.baseMapId,
        listingId: context.targetListingId,
        annotationTemplateId: vctTemplate.id,
        type: "POLYLINE",
        points: refs,
        height: vi.height ?? null,
        ...(context.activeLayerId ? { layerId: context.activeLayerId } : {}),
      });
      newRels.push(...buildRels(retId, vctTemplate, context));
    }

    // update VI to keep only the middle portion
    const middleRefs = [];
    if (ss) middleRefs.push(ss.splitRef);
    if (middleStart <= middleEnd) {
      middleRefs.push(
        ...ptRefs.slice(middleStart, middleEnd + 1).map((p) => ({ id: p.id }))
      );
    }
    if (es) middleRefs.push(es.splitRef);
    vi.points = middleRefs;
  }

  annotations.push(...newAnnotations);
  rels.push(...newRels);
}
