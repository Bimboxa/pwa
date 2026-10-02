// Where a plan point falls on a polyline (its nearest segment): the vertex it
// is on — { vertexIndex, distance } — or the point inserted on a segment —
// { segmentIndex, t, x, y, distance } (segment segmentIndex → segmentIndex+1,
// the closing one when `closeLine`). Null for a degenerate polyline.
//
// points: [{x, y}] in one metric frame; tolerance: the snapping distance to a
// vertex along the segment.
export default function locatePlanPointOnPolyline(
  points,
  p,
  { closeLine = false, tolerance = 1e-2 } = {}
) {
  if (!points || points.length < 2 || !p) return null;
  const count = closeLine ? points.length : points.length - 1;

  let best = null;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const raw = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length);
    const t = Math.min(1, Math.max(0, raw));
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    const distance = Math.hypot(p.x - x, p.y - y);
    if (!best || distance < best.distance - 1e-12) {
      best = { segmentIndex: i, t, x, y, distance, length };
    }
  }
  if (!best) return null;

  const { segmentIndex, t, x, y, distance, length } = best;
  if (t * length <= tolerance) return { vertexIndex: segmentIndex, distance };
  if ((1 - t) * length <= tolerance) {
    return { vertexIndex: (segmentIndex + 1) % points.length, distance };
  }
  return { segmentIndex, t, x, y, distance };
}
