// Move the first/last point of an open polyline inward along its own end
// segment by `shrinkPx`, clamped to 40% of that segment so it never crosses
// the adjacent vertex. Preserves array length (and thus the per-vertex
// offsetBottom/offsetTop mapping callers rely on).
export default function shrinkPolylineEnds(points, shrinkPx) {
  if (shrinkPx <= 0 || points.length < 2) return points;
  const out = points.map((p) => ({ ...p }));
  const move = (fromIdx, towardIdx) => {
    const a = out[fromIdx];
    const b = out[towardIdx];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const d = Math.min(shrinkPx, len * 0.4);
    a.x += (dx / len) * d;
    a.y += (dy / len) * d;
  };
  move(0, 1);
  move(points.length - 1, points.length - 2);
  return out;
}
