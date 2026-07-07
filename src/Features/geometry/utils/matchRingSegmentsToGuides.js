import { typeOf } from "./arcSampling";
import { findGuideEdgeForSubEdge } from "./classifyRingByGuideEdges";
import { lineLineIntersection } from "./wallToRectRing";

// skip subdivision points closer than 1px to an existing vertex
const SUBDIV_DEDUP_PX = 1;

// a non-matched run sandwiched between two matched runs is absorbed when its
// total length is below this many times the tolerance (band-corner stubs at
// wall/guide junctions)
const MERGE_GAP_FACTOR = 3;

// snapped vertices closer than this collapse into one
const COLLAPSE_EPS_PX = 0.1;

// a snap target farther than this many times the tolerance is rejected
// (near-parallel line intersections shoot far away)
const SNAP_GUARD_FACTOR = 2;

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

function projectOntoLine(p, e) {
  const abx = e.bx - e.ax;
  const aby = e.by - e.ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return { x: e.ax, y: e.ay };
  const t = ((p.x - e.ax) * abx + (p.y - e.ay) * aby) / lenSq;
  return { x: e.ax + t * abx, y: e.ay + t * aby };
}

function edgeLine(e) {
  return { p: { x: e.ax, y: e.ay }, v: { x: e.bx - e.ax, y: e.by - e.ay } };
}

// Both intersections of the line (a, v) with a circle, or null.
function lineCircleIntersections(a, v, circle) {
  const dx = a.x - circle.center.x;
  const dy = a.y - circle.center.y;
  const A = v.x * v.x + v.y * v.y;
  if (A < 1e-12) return null;
  const B = 2 * (dx * v.x + dy * v.y);
  const C = dx * dx + dy * dy - circle.r * circle.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-B - sq) / (2 * A);
  const t2 = (-B + sq) / (2 * A);
  return [
    { x: a.x + t1 * v.x, y: a.y + t1 * v.y },
    { x: a.x + t2 * v.x, y: a.y + t2 * v.y },
  ];
}

/**
 * Subdivide ring segments by projecting guide vertices onto them (same idea
 * as subdivideRingByForeignProjections), but arc-aware: segments touching a
 * circle-typed control point are matched/snapped as a unit and never split.
 */
function subdivideStraightSegments(ring, guideEdges, detectionPx) {
  if (guideEdges.length === 0) return ring;

  const seen = new Set();
  const vertices = [];
  for (const e of guideEdges) {
    const kA = `${e.ax},${e.ay}`;
    if (!seen.has(kA)) {
      seen.add(kA);
      vertices.push({ x: e.ax, y: e.ay });
    }
    const kB = `${e.bx},${e.by}`;
    if (!seen.has(kB)) {
      seen.add(kB);
      vertices.push({ x: e.bx, y: e.by });
    }
  }

  const N = ring.length;
  const result = [];
  for (let i = 0; i < N; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % N];
    result.push(a);
    if (typeOf(a) === "circle" || typeOf(b) === "circle") continue;

    const projections = [];
    for (const fv of vertices) {
      const proj = projectOntoSegment(fv.x, fv.y, a.x, a.y, b.x, b.y);
      if (!proj || proj.dist > detectionPx) continue;
      if (
        Math.hypot(proj.projPt.x - a.x, proj.projPt.y - a.y) < SUBDIV_DEDUP_PX
      )
        continue;
      if (
        Math.hypot(proj.projPt.x - b.x, proj.projPt.y - b.y) < SUBDIV_DEDUP_PX
      )
        continue;
      projections.push(proj);
    }
    projections.sort((p1, p2) => p1.t - p2.t);

    let lastPt = a;
    for (const proj of projections) {
      const pp = proj.projPt;
      if (Math.hypot(pp.x - lastPt.x, pp.y - lastPt.y) < SUBDIV_DEDUP_PX)
        continue;
      const newPt = { x: pp.x, y: pp.y };
      result.push(newPt);
      lastPt = newPt;
    }
  }
  return result;
}

/**
 * Guide circle an S-C-S arc runs along, or null: the middle control point
 * within (tolPx + circle padPx) of the circle, the S endpoints within the
 * relaxed (endpointSlackPx + padPx) — the union re-fits arc runs whose
 * endpoints land on wall-junction corners, off the circle by up to the
 * neighboring wall's half-width.
 */
function findGuideCircleForArc(
  s0,
  c,
  s1,
  guideCircles,
  tolPx,
  endpointSlackPx
) {
  for (const gc of guideCircles) {
    const pad = gc.padPx || 0;
    const radialDist = (p) =>
      Math.abs(Math.hypot(p.x - gc.center.x, p.y - gc.center.y) - gc.r);
    if (radialDist(c) > tolPx + pad) continue;
    if (radialDist(s0) > endpointSlackPx + pad) continue;
    if (radialDist(s1) > endpointSlackPx + pad) continue;
    return gc;
  }
  return null;
}

/**
 * Match the segments of a closed ring against guide centerlines (px "virtual
 * boundary" polylines): segments running along a guide are SNAPPED exactly
 * onto the guide geometry and reported as hidden.
 *
 * - Straight sub-edges match via findGuideEdgeForSubEdge (endpoints + midpoint
 *   within tolPx + edge padPx, near-parallel).
 * - S-C-S arcs match as a unit against guide circles (concentric within
 *   tolPx + padPx); both of the arc's segment indices are reported.
 * - Short unmatched straight runs between two matched runs are absorbed
 *   (band-corner stubs at wall/guide junctions).
 * - Snapping: arc points project radially onto the guide circle; interior
 *   vertices of a hidden run project onto the guide edge line (guide corners
 *   use the two edge lines' intersection); boundary vertices (hidden on one
 *   side only) sit at the intersection of the guide line with the visible
 *   segment's line — the wall-inner-face × guide corner.
 *
 * @param {Array<{x,y,type?}>} ringPoints - closed ring, open array (last ≠ first), px space
 * @param {Array<{ax,ay,bx,by,padPx?}>} guideEdges - tessellated guide centerline segments
 * @param {Array<{center:{x,y}, r:number, padPx?:number}>} guideCircles - circles of guide S-C-S arcs
 * @param {{tolPx?: number, arcEndpointSlackPx?: number}} [opts] - base
 *   detection tolerance (pixels); arcEndpointSlackPx relaxes the arc S
 *   endpoints only (junction corners sit off the circle by up to the
 *   neighboring wall's half-width)
 * @returns {{ring: Array<{x,y,type?}>, hiddenSegmentsIdx: number[]}}
 *   New ring (may be re-anchored / subdivided / collapsed) and the hidden
 *   segment indices valid for it (segment i = ring[i] → ring[(i+1)%N]).
 */
export default function matchRingSegmentsToGuides(
  ringPoints,
  guideEdges,
  guideCircles,
  { tolPx = 1, arcEndpointSlackPx } = {}
) {
  const noMatch = { ring: ringPoints, hiddenSegmentsIdx: [] };
  const edges = guideEdges ?? [];
  const circles = guideCircles ?? [];
  if (!ringPoints || ringPoints.length < 3) return noMatch;
  if (edges.length === 0 && circles.length === 0) return noMatch;

  let maxPadPx = 0;
  for (const e of edges) if ((e.padPx || 0) > maxPadPx) maxPadPx = e.padPx;
  for (const c of circles) if ((c.padPx || 0) > maxPadPx) maxPadPx = c.padPx;
  const snapGuardPx = SNAP_GUARD_FACTOR * (tolPx + maxPadPx);
  const arcSlackPx = Math.max(arcEndpointSlackPx ?? tolPx, tolPx);
  const arcSnapGuardPx = SNAP_GUARD_FACTOR * (arcSlackPx + maxPadPx);

  // Start the ring on a non-circle point so S-C-S pairs never straddle index 0.
  const start = ringPoints.findIndex((p) => typeOf(p) !== "circle");
  if (start < 0) return noMatch;
  let ring = [...ringPoints.slice(start), ...ringPoints.slice(0, start)].map(
    (p) => ({ ...p })
  );

  ring = subdivideStraightSegments(ring, edges, tolPx + maxPadPx);
  const N = ring.length;

  // --- classify each segment (segment i = ring[i] → ring[(i+1)%N]) ---
  const segMatch = new Array(N).fill(null);
  const segIsArc = new Array(N).fill(false);
  let i = 0;
  while (i < N) {
    const p1 = ring[(i + 1) % N];
    const p2 = ring[(i + 2) % N];
    const isArcPair =
      typeOf(ring[i]) !== "circle" &&
      typeOf(p1) === "circle" &&
      typeOf(p2) !== "circle";
    if (isArcPair) {
      segIsArc[i] = true;
      segIsArc[(i + 1) % N] = true;
      const circle = findGuideCircleForArc(
        ring[i],
        p1,
        p2,
        circles,
        tolPx,
        arcSlackPx
      );
      if (circle) {
        segMatch[i] = { circle };
        segMatch[(i + 1) % N] = { circle };
      }
      i += 2;
    } else {
      const edge = findGuideEdgeForSubEdge(ring[i], p1, edges, tolPx);
      if (edge) segMatch[i] = { edge };
      i += 1;
    }
  }

  if (!segMatch.some(Boolean)) return noMatch;

  // --- absorb short unmatched straight runs between two matched runs ---
  if (segMatch.some((m) => !m)) {
    const maxGapPx = MERGE_GAP_FACTOR * tolPx;
    let anchor = 0;
    while (anchor < N && !segMatch[anchor]) anchor++;
    let k = 0;
    while (k < N) {
      const idx = (anchor + k) % N;
      if (segMatch[idx]) {
        k++;
        continue;
      }
      const runStart = k;
      let lenPx = 0;
      let hasArc = false;
      while (k < N && !segMatch[(anchor + k) % N]) {
        const j = (anchor + k) % N;
        if (segIsArc[j]) hasArc = true;
        const q1 = ring[j];
        const q2 = ring[(j + 1) % N];
        lenPx += Math.hypot(q2.x - q1.x, q2.y - q1.y);
        k++;
      }
      if (!hasArc && lenPx <= maxGapPx) {
        // Inherit the following matched run's geometry so the junction
        // vertices still snap onto the guide.
        const followMatch = segMatch[(anchor + k) % N];
        for (let j = runStart; j < k; j++) {
          segMatch[(anchor + j) % N] = followMatch;
        }
      }
    }
  }

  // --- snap matched vertices onto the guide geometry ---
  // Targets are computed from the ORIGINAL positions so the result does not
  // depend on the iteration order.
  const snapped = ring.map((p) => ({ ...p }));
  for (let k = 0; k < N; k++) {
    const p = ring[k];
    const prev = segMatch[(k - 1 + N) % N];
    const next = segMatch[k];
    if (!prev && !next) continue;

    const circle = prev?.circle ?? next?.circle;
    if (circle) {
      // Arc endpoint against a visible segment (wall face): guide circle ×
      // visible line, so the corner sits exactly on both.
      let target = null;
      if (!prev || !next) {
        const visA = prev ? ring[k] : ring[(k - 1 + N) % N];
        const visB = prev ? ring[(k + 1) % N] : ring[k];
        const visV = { x: visB.x - visA.x, y: visB.y - visA.y };
        const inters = lineCircleIntersections(visA, visV, circle);
        if (inters) {
          const best = inters.reduce((acc, q) =>
            Math.hypot(q.x - p.x, q.y - p.y) <
            Math.hypot(acc.x - p.x, acc.y - p.y)
              ? q
              : acc
          );
          if (Math.hypot(best.x - p.x, best.y - p.y) <= arcSnapGuardPx) {
            target = best;
          }
        }
      }
      if (!target) {
        // radial projection onto the matched guide circle
        const dx = p.x - circle.center.x;
        const dy = p.y - circle.center.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-9) {
          target = {
            x: circle.center.x + (dx * circle.r) / d,
            y: circle.center.y + (dy * circle.r) / d,
          };
        }
      }
      if (target) {
        snapped[k].x = target.x;
        snapped[k].y = target.y;
      }
      continue;
    }

    const e1 = prev?.edge;
    const e2 = next?.edge;
    if (e1 && e2) {
      // interior vertex of a hidden run: guide corner (two distinct edges)
      // or straight run (same edge)
      let target = null;
      if (e1 !== e2) {
        const l1 = edgeLine(e1);
        const l2 = edgeLine(e2);
        const inter = lineLineIntersection(l1.p, l1.v, l2.p, l2.v);
        if (inter && Math.hypot(inter.x - p.x, inter.y - p.y) <= snapGuardPx) {
          target = inter;
        }
      }
      if (!target) target = projectOntoLine(p, e1);
      snapped[k].x = target.x;
      snapped[k].y = target.y;
      continue;
    }

    const e = e1 ?? e2;
    if (!e) continue;
    // Boundary vertex (hidden on one side only): the wall-inner-face × guide
    // corner — intersect the guide line with the visible segment's line.
    const visA = e1 ? ring[k] : ring[(k - 1 + N) % N];
    const visB = e1 ? ring[(k + 1) % N] : ring[k];
    const visV = { x: visB.x - visA.x, y: visB.y - visA.y };
    let target = null;
    if (Math.hypot(visV.x, visV.y) > 1e-9) {
      const l = edgeLine(e);
      const inter = lineLineIntersection(l.p, l.v, visA, visV);
      if (inter && Math.hypot(inter.x - p.x, inter.y - p.y) <= snapGuardPx) {
        target = inter;
      }
    }
    if (!target) target = projectOntoLine(p, e);
    snapped[k].x = target.x;
    snapped[k].y = target.y;
  }

  // --- collapse degenerate segments created by snapping ---
  // node k = vertex + the flag of its outgoing segment k → k+1
  const nodes = snapped.map((p, k) => ({ p, hidden: !!segMatch[k] }));
  let collapsed = true;
  while (collapsed && nodes.length > 3) {
    collapsed = false;
    for (let k = 0; k < nodes.length; k++) {
      const j = (k + 1) % nodes.length;
      const a = nodes[k].p;
      const b = nodes[j].p;
      if (Math.hypot(b.x - a.x, b.y - a.y) >= COLLAPSE_EPS_PX) continue;
      // segment k → j is degenerate: drop one vertex (keep arc control points)
      const victim = typeOf(b) === "circle" && typeOf(a) !== "circle" ? k : j;
      if (victim === j) {
        // merged segment keeps the surviving segment j's flag
        nodes[k].hidden = nodes[j].hidden;
        nodes.splice(j, 1);
      } else {
        // node k-1's segment absorbs the degenerate one and keeps its flag
        nodes.splice(k, 1);
      }
      collapsed = true;
      break;
    }
  }

  const hiddenSegmentsIdx = [];
  nodes.forEach((n, k) => {
    if (n.hidden) hiddenSegmentsIdx.push(k);
  });
  return { ring: nodes.map((n) => n.p), hiddenSegmentsIdx };
}
