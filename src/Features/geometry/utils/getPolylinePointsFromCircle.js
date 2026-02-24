// Compute the circumscribed circle from 3 points, then return 4 inscribed-square
// vertices with alternating types (square / circle) so the existing arc renderer
// draws a full circle.

function getCircleFrom3Points(p1, p2, p3) {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  // Collinear check
  if (Math.abs(D) < 1e-10) return null;

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    D;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    D;

  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

  return { cx: ux, cy: uy, r };
}

export default function getPolylinePointsFromCircle(points) {
  if (points.length !== 3) return points;

  const circle = getCircleFrom3Points(points[0], points[1], points[2]);
  if (!circle) return points;

  const { cx, cy, r } = circle;

  // Inscribed square: 4 vertices on the circle at 0°, 90°, 180°, 270°
  // Alternating types: square, circle, square, circle
  return [
    { x: cx + r, y: cy, type: "square" },
    { x: cx, y: cy + r, type: "circle" },
    { x: cx - r, y: cy, type: "square" },
    { x: cx, y: cy - r, type: "circle" },
  ];
}

export { getCircleFrom3Points };
