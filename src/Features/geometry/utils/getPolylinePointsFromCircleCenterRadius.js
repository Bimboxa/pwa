// Build a circle from a center point + an edge point (radius = distance between
// them) and return 4 inscribed-square vertices with alternating types
// (square / circle) so the existing arc renderer draws a full circle — same
// output shape as getPolylinePointsFromCircle (the 3-point variant).

export default function getPolylinePointsFromCircleCenterRadius(points) {
  if (!points || points.length !== 2) return points;

  const [center, edge] = points;
  const r = Math.hypot(edge.x - center.x, edge.y - center.y);
  if (!(r > 0)) return points;

  const { x: cx, y: cy } = center;

  // Inscribed square: 4 vertices on the circle at 0°, 90°, 180°, 270°
  // Alternating types: square, circle, square, circle
  return [
    { x: cx + r, y: cy, type: "square" },
    { x: cx, y: cy + r, type: "circle" },
    { x: cx - r, y: cy, type: "square" },
    { x: cx, y: cy - r, type: "circle" },
  ];
}
