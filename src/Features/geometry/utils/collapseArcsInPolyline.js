// collapseArcsInPolyline
//
// Post-processing for vectorised wall centerlines. Scans a polyline (pixel
// space) for maximal runs of vertices that lie on a common circle and turns
// each such run into a single S-C-S arc (3 points: square, circle, square —
// the codebase arc convention rendered by NodePolylineStatic). Everything
// else stays as "straight" runs.
//
// Conservative by default; a run is also accepted (with a relaxed tolerance
// and no curvature gate) when its fitted circle matches one of the SOURCE
// polygon arc circles — i.e. the polygon edge that framed the wall was
// itself an arc (robust provenance hint passed in via `sourceArcCircles`).
//
// Returns an ordered list of units that exactly covers the polyline:
//   { kind: "straight", points: [{x,y}, ...] }   (>= 2 points)
//   { kind: "arc",      points: [sq, circle, sq] }
// Consecutive units share their boundary vertex coordinates, so the caller's
// point-snap grid keeps the junctions continuous.
//
// Pure function: no React, no Redux, no Dexie.

import { circleFromThreePoints } from "./arcSampling";
import getPolylinePointsFromArc from "./getPolylinePointsFromArc";

const MIN_ARC_POINTS = 4; // >= 4 consecutive vertices
const MIN_TURN_RAD = (20 * Math.PI) / 180; // real curve, not a single corner
const MAX_RADIUS_PX = 1e5;
const TWO_PI = Math.PI * 2;

function norm2pi(a) {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x;
}

// Central angle of the arc A→B that passes through the interior reference R,
// and the direction (ccw) of that arc.
function arcSpan(center, A, B, R) {
  const aA = Math.atan2(A.y - center.y, A.x - center.x);
  const aB = Math.atan2(B.y - center.y, B.x - center.x);
  const aR = Math.atan2(R.y - center.y, R.x - center.x);
  const dCCW = norm2pi(aB - aA);
  const rCCW = norm2pi(aR - aA);
  const ccw = rCCW <= dCCW; // R lies on the CCW arc from A to B
  const span = ccw ? dCCW : TWO_PI - dCCW;
  return { aA, span, ccw };
}

function midPointOnArc(center, r, A, B, R) {
  const { aA, span, ccw } = arcSpan(center, A, B, R);
  const aMid = ccw ? aA + span / 2 : aA - span / 2;
  return { x: center.x + r * Math.cos(aMid), y: center.y + r * Math.sin(aMid) };
}

function matchesSourceArc(circle, sourceArcCircles, thicknessPx, baseTol) {
  if (!sourceArcCircles || sourceArcCircles.length === 0) return false;
  const cTol = Math.max(thicknessPx, baseTol * 2);
  const rTol = thicknessPx * 0.5 + baseTol * 2;
  for (const s of sourceArcCircles) {
    if (!s || !s.center) continue;
    if (
      Math.hypot(circle.center.x - s.center.x, circle.center.y - s.center.y) <=
        cTol &&
      Math.abs(circle.r - s.r) <= rTol
    ) {
      return true;
    }
  }
  return false;
}

// Fit + validate the inclusive run pts[s..e]. Returns { circle, midIdx } or
// null when the run is not a clean circular arc.
function fitRun(pts, s, e, thicknessPx, sourceArcCircles, requireSourceMatch) {
  const midIdx = (s + e) >> 1;
  const A = pts[s];
  const M = pts[midIdx];
  const B = pts[e];
  if (!A || !M || !B) return null;

  const circle = circleFromThreePoints(A, M, B);
  if (!circle || !(circle.r > 0) || circle.r > MAX_RADIUS_PX) return null;

  const baseTol = Math.max(1, 0.25 * thicknessPx);
  const fromSource = matchesSourceArc(
    circle,
    sourceArcCircles,
    thicknessPx,
    baseTol
  );
  // When the caller only trusts arcs that are concentric with a known source
  // arc (e.g. wall-contour offsets, which are always concentric with the wall
  // arc), reject any run that does not match — keeps straight junction stubs
  // and corners from being mis-fitted as arcs.
  if (requireSourceMatch && !fromSource) return null;
  const tol = fromSource ? Math.max(baseTol, 0.6 * thicknessPx) : baseTol;

  for (let k = s; k <= e; k++) {
    const p = pts[k];
    if (!p) return null;
    const d = Math.abs(
      Math.hypot(p.x - circle.center.x, p.y - circle.center.y) - circle.r
    );
    if (d > tol) return null;
  }

  if (!fromSource) {
    const { span } = arcSpan(circle.center, A, B, M);
    if (!(span > MIN_TURN_RAD)) return null;
  }
  return { circle, midIdx };
}

export default function collapseArcsInPolyline(pointsPx, opts = {}) {
  const pts = Array.isArray(pointsPx)
    ? pointsPx.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    : [];
  const n = pts.length;
  if (n < 2) return [];
  if (n < MIN_ARC_POINTS) {
    return [{ kind: "straight", points: pts.map((p) => ({ x: p.x, y: p.y })) }];
  }

  const thicknessPx = opts.thicknessPx || 0;
  const sourceArcCircles = opts.sourceArcCircles || [];
  const requireSourceMatch = opts.requireSourceMatch || false;

  // 1. Greedy, maximal, non-overlapping arc intervals. Adjacent units share
  //    their boundary vertex (s = previous arc's end index).
  const arcs = [];
  let s = 0;
  while (s + MIN_ARC_POINTS - 1 < n) {
    let e = s + MIN_ARC_POINTS - 1;
    let fit = fitRun(
      pts,
      s,
      e,
      thicknessPx,
      sourceArcCircles,
      requireSourceMatch
    );
    if (!fit) {
      s += 1;
      continue;
    }
    while (e + 1 < n) {
      const next = fitRun(
        pts,
        s,
        e + 1,
        thicknessPx,
        sourceArcCircles,
        requireSourceMatch
      );
      if (!next) break;
      e += 1;
      fit = next;
    }
    arcs.push({ s, e, circle: fit.circle, midIdx: fit.midIdx });
    s = e;
  }

  if (arcs.length === 0) {
    return [{ kind: "straight", points: pts.map((p) => ({ x: p.x, y: p.y })) }];
  }

  // 2. Ordered units (straight pieces + arc triples), sharing boundaries.
  const units = [];
  let cursor = 0;
  for (const arc of arcs) {
    if (arc.s > cursor) {
      units.push({
        kind: "straight",
        points: pts.slice(cursor, arc.s + 1).map((p) => ({ x: p.x, y: p.y })),
      });
    }
    const A = pts[arc.s];
    const B = pts[arc.e];
    const R = pts[arc.midIdx];
    const mid = midPointOnArc(arc.circle.center, arc.circle.r, A, B, R);
    units.push({
      kind: "arc",
      points: getPolylinePointsFromArc([
        { x: A.x, y: A.y },
        { x: mid.x, y: mid.y },
        { x: B.x, y: B.y },
      ]),
    });
    cursor = arc.e;
  }
  if (cursor <= n - 1) {
    const tail = pts.slice(cursor).map((p) => ({ x: p.x, y: p.y }));
    if (tail.length >= 2) units.push({ kind: "straight", points: tail });
  }

  return units.filter(
    (u) => u.kind === "arc" || (u.points && u.points.length >= 2)
  );
}
