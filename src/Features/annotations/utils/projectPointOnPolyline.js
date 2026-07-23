import projectPointOnSegment from "Features/annotations/utils/projectPointOnSegment";

// Orthogonally projects a 2D point onto a polyline and returns the
// arc-length parameter `s` (cumulative length from the polyline start to the
// foot of the perpendicular) of the closest segment, plus that distance, the
// projected point, and the owning segment (`segIndex`, local parameter `t`).
//
// `polyline` is an ordered array of pixel points [{x,y}, ...] (already
// arc-expanded by the caller when it carries `type:"circle"` control points).
// `s` is in the same (pixel) units as the polyline; divide by the total
// length for a normalized parameter.
export default function projectPointOnPolyline(point, polyline) {
  if (!point || !Array.isArray(polyline) || polyline.length < 2) return null;

  let cum = 0;
  let best = null;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const proj = projectPointOnSegment(point, a, b);
    if (!best || proj.distance < best.distance) {
      best = {
        s: cum + proj.t * segLen,
        distance: proj.distance,
        projected: proj.projectedPoint,
        segIndex: i,
        t: proj.t,
      };
    }
    cum += segLen;
  }
  return best;
}
