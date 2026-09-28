// Ramer-Douglas-Peucker simplification of an open polyline ({x, y} points).
// Keeps the first and last points; drops every intermediate point whose
// distance to the current chord is below `tolerance` (same unit as x/y).
export default function simplifyPolylineRdp(points, tolerance = 1) {
  if (!Array.isArray(points) || points.length <= 2) return points ?? [];
  const tol2 = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const pa = points[a];
    const pb = points[b];
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len2 = dx * dx + dy * dy;
    let maxD2 = -1;
    let maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i];
      let d2;
      if (len2 === 0) {
        const ex = p.x - pa.x;
        const ey = p.y - pa.y;
        d2 = ex * ex + ey * ey;
      } else {
        const cross = dx * (p.y - pa.y) - dy * (p.x - pa.x);
        d2 = (cross * cross) / len2;
      }
      if (d2 > maxD2) {
        maxD2 = d2;
        maxI = i;
      }
    }
    if (maxD2 > tol2) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }

  return points.filter((_, i) => keep[i]);
}
