// Attach square-circle-square types to 3 clicked points so the existing
// NodePolylineStatic arc renderer draws an SVG arc through them.

export default function getPolylinePointsFromArc(points) {
  if (points.length !== 3) return points;
  return [
    { ...points[0], type: "square" },
    { ...points[1], type: "circle" },
    { ...points[2], type: "square" },
  ];
}
