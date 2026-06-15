// Smooth/simplify a polyline by dropping points that barely deviate from the
// chord through their neighbours (Ramer–Douglas–Peucker). Removes jitter/noise
// from a hand- or auto-traced line while preserving real corners.
//
// All coordinates are plain {x, y} in pixel space. `epsilon` is the max
// perpendicular deviation (px) a point may have before it is kept.

function perpDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

function rdp(points, epsilon) {
  if (points.length < 3) return points.slice();
  let dMax = 0;
  let idx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i], first, last);
    if (d > dMax) {
      dMax = d;
      idx = i;
    }
  }
  if (dMax > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon);
    const right = rdp(points.slice(idx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function bboxDiag(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

// Returns the simplified points (always [{x,y}]). `closed` keeps the simplified
// ring valid (≥3 points). `epsilon` defaults to a small fraction of the bbox
// diagonal, floored at 1.5 px.
export default function smoothPolyline(
  points,
  { closed = false, epsilon } = {}
) {
  if (!Array.isArray(points) || points.length < 3) {
    return (points || []).map((p) => ({ x: p.x, y: p.y }));
  }
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const eps = epsilon ?? Math.max(1.5, bboxDiag(pts) * 0.005);
  const simplified = rdp(pts, eps);
  if (closed && simplified.length < 3) return pts;
  if (!closed && simplified.length < 2) return pts;
  return simplified;
}
