export default function computeShapeSurface(shape, map) {
  if (!shape || !map) return 0;

  const width = map.imageWidth * map.meterByPx;
  const height = map.imageHeight * map.meterByPx;

  const vertices = shape.points.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  let area = 0;

  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n; // Next vertex (loop back at the end)
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }

  return Math.abs(area / 2);
}
