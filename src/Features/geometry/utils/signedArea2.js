/**
 * Compute twice the signed area of a ring (shoelace formula).
 * In screen coordinates (y-down): positive → clockwise, negative → counter-clockwise.
 */
export default function signedArea2(points) {
  let s = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    s += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return s;
}
