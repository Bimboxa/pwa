// Turns the dense frontier chain of detectRegionBoundary into the points of a
// POLYLINE annotation: circular runs become arcs (square → circle → square,
// the convention rendered by NodePolylineStatic), the rest straight segments
// with their collinear vertices dropped.
//
// Pure function (pixel space in, pixel space out).

import fitArcSplineThroughPolyline from "Features/geometry/utils/fitArcSplineThroughPolyline";
import simplifyPolylineRdp from "Features/geometry/utils/simplifyPolylineRdp";

// The arc fit is quadratic in the number of vertices: the chain is resampled
// to at most this many evenly spaced points first.
const MAX_FIT_POINTS = 80;

function resampleEvenly(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const cumulated = [0];
  for (let i = 1; i < points.length; i++) {
    cumulated.push(
      cumulated[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    );
  }
  const total = cumulated[cumulated.length - 1];
  if (!(total > 0)) return points;

  const out = [];
  let seg = 1;
  for (let k = 0; k < maxPoints; k++) {
    const target = (total * k) / (maxPoints - 1);
    while (seg < points.length - 1 && cumulated[seg] < target) seg += 1;
    const span = cumulated[seg] - cumulated[seg - 1];
    const t = span > 0 ? (target - cumulated[seg - 1]) / span : 0;
    const a = points[seg - 1];
    const b = points[seg];
    out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  }
  return out;
}

// Simplifies every run of consecutive "square" points (the arc triplets are
// left untouched).
function simplifyStraightRuns(chainPoints, tolerance) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length === 0) return;
    const simplified = simplifyPolylineRdp(run, tolerance);
    // the first point of a run that follows an arc is the arc's end point
    const start = out.length > 0 && run[0] === out[out.length - 1] ? 1 : 0;
    for (let i = start; i < simplified.length; i++) out.push(simplified[i]);
    run = [];
  };
  for (let i = 0; i < chainPoints.length; i++) {
    const point = chainPoints[i];
    if (point.type === "circle") {
      // the arc starts on the last point of the run, kept by the RDP
      flush();
      out.push(point);
      const end = chainPoints[i + 1];
      if (end) {
        out.push(end);
        run = [end];
        i += 1;
      }
      continue;
    }
    run.push(point);
  }
  flush();
  return out;
}

/**
 * @param {Array<{x:number,y:number}>} chain Dense open chain, px.
 * @param {Object} [options]
 * @param {number} [options.tolerance=2] Max distance (px) between the chain
 *   and the arcs / segments replacing it.
 * @returns {Array<{x:number,y:number,type?:string}>} Points of the polyline
 *   (`type: "circle"` on the arc control points).
 */
export default function boundaryChainToPolylinePoints(
  chain,
  { tolerance = 2 } = {}
) {
  const points = (chain ?? []).filter(
    (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  );
  if (points.length < 2) return [];

  const sampled = resampleEvenly(points, MAX_FIT_POINTS);
  const fit = fitArcSplineThroughPolyline(sampled, { tol: tolerance });
  if (!fit?.chainPoints?.length) {
    return simplifyPolylineRdp(points, tolerance).map(({ x, y }) => ({ x, y }));
  }

  return simplifyStraightRuns(fit.chainPoints, tolerance).map((p) =>
    p.type === "circle" ? { x: p.x, y: p.y, type: "circle" } : { x: p.x, y: p.y }
  );
}
