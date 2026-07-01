// Line/arc segmentation of a single ordered polyline.
//
// Unlike fitCircleArcThroughPoints (which fits ONE circle through ALL points),
// this walks a single polyline and greedily carves it into a chain of straight
// segments and circular arcs, keeping straight runs straight and replacing
// genuinely curved runs with `square → circle → square` arc triplets that the
// NodePolylineStatic renderer draws as SVG arcs.
//
// Output is a flat `chainPoints` list (pixel space) with `type` markers, the
// same contract fitCircleArcThroughPoints produces:
//   - line  → consecutive "square" points
//   - arc   → "square", "circle", "square" (sub-arcs each < 180°)
// Shared endpoints between consecutive primitives appear only once.

import fitCircleArcThroughPoints from "./fitCircleArcThroughPoints";

const EPS = 1e-6;

// Minimum swept angle for a run to be worth turning into an arc (~12°). Below
// this the run is essentially straight and is left as line segments.
const MIN_ARC_SPAN = (12 * Math.PI) / 180;

// Minimum points an arc must cover. A circle through exactly 3 points is an
// EXACT fit (zero deviation), so any triple — including a sharp corner or
// noise — would otherwise pass the tolerance test. Requiring ≥ 4 points forces
// the circle to genuinely agree with a sustained run.
const MIN_ARC_PTS = 4;

// Max perpendicular distance of a run from the straight chord (first → last).
// This is the arc's sagitta: it measures REAL curvature, independent of radius,
// and is what separates a true arc from a near-straight run or jitter.
function maxChordDeviation(run) {
  const a = run[0];
  const b = run[run.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return 0;
  let maxDev = 0;
  for (const p of run) {
    const d = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    if (d > maxDev) maxDev = d;
  }
  return maxDev;
}

function bboxDiag(pts) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

// Max radial deviation of a run from the fitted circle.
function maxRadialDeviation(run, center, r) {
  let maxDev = 0;
  for (const p of run) {
    const dev = Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r);
    if (dev > maxDev) maxDev = dev;
  }
  return maxDev;
}

// Try to fit a single arc to points[start..end] (inclusive). Returns the fit
// augmented with its max radial deviation, or null when the run is straight /
// degenerate / not curved enough to be worth an arc.
function tryArc(points, start, end, tol) {
  const run = points.slice(start, end + 1);
  if (run.length < MIN_ARC_PTS) return null;

  const fit = fitCircleArcThroughPoints(run);
  if (!fit) return null; // collinear / degenerate

  if (fit.span < MIN_ARC_SPAN) return null;

  // The circle must agree with every point of the run (now meaningful since
  // the run has > 3 points). A sharp corner or right angle fails here.
  const dev = maxRadialDeviation(run, fit.center, fit.r);
  if (dev > tol) return null;

  // The run must be genuinely curved, not a near-straight line the circle fit
  // latched onto. Require a sagitta comfortably above the noise floor so that
  // jitter on a straight segment is never promoted to an arc.
  const sagitta = maxChordDeviation(run);
  if (sagitta < Math.max(2, 3 * tol)) return null;

  return { ...fit, dev };
}

export default function fitArcSplineThroughPolyline(points, { tol } = {}) {
  if (!Array.isArray(points)) return null;

  // Keep order, drop consecutive duplicates.
  const pts = [];
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const prev = pts[pts.length - 1];
    if (prev && Math.abs(prev.x - p.x) < EPS && Math.abs(prev.y - p.y) < EPS) {
      continue;
    }
    pts.push({ x: p.x, y: p.y });
  }
  if (pts.length < 3) return null;

  const tolerance =
    Number.isFinite(tol) && tol > 0 ? tol : Math.max(2, bboxDiag(pts) * 0.005);

  const N = pts.length;
  const chainPoints = [];

  // Push a point, collapsing the shared endpoint with the previous primitive.
  const pushPoint = (pt) => {
    const last = chainPoints[chainPoints.length - 1];
    if (
      last &&
      Math.abs(last.x - pt.x) < EPS &&
      Math.abs(last.y - pt.y) < EPS &&
      last.type === "square" &&
      pt.type === "square"
    ) {
      return; // shared line/arc endpoint already present
    }
    chainPoints.push(pt);
  };

  let start = 0;
  // Seed with the very first vertex so a leading line keeps its origin.
  pushPoint({ x: pts[0].x, y: pts[0].y, type: "square" });

  while (start < N - 1) {
    // Greedily grow the longest acceptable arc starting at `start`.
    let bestEnd = -1;
    let bestFit = null;
    for (let end = start + 2; end < N; end++) {
      const fit = tryArc(pts, start, end, tolerance);
      if (fit) {
        bestEnd = end;
        bestFit = fit;
      } else if (bestEnd !== -1) {
        // Once an arc was valid and a longer window fails, stop extending:
        // the run has left the circle.
        break;
      }
    }

    if (bestFit && bestEnd !== -1) {
      // Emit the arc chain, snapping its outer endpoints onto the real
      // polyline vertices for continuity with neighbouring primitives.
      const chain = bestFit.chainPoints;
      const snapped = chain.map((p) => ({ ...p }));
      snapped[0] = { x: pts[start].x, y: pts[start].y, type: "square" };
      snapped[snapped.length - 1] = {
        x: pts[bestEnd].x,
        y: pts[bestEnd].y,
        type: "square",
      };
      for (const p of snapped) pushPoint(p);
      start = bestEnd;
    } else {
      // No arc: emit a straight segment to the next vertex.
      pushPoint({ x: pts[start + 1].x, y: pts[start + 1].y, type: "square" });
      start += 1;
    }
  }

  return { chainPoints };
}
