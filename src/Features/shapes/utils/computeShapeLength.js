export default function computeShapeLength(shape, map) {
  if (!shape || !map) return 0;

  const width = map.imageWidth * map.meterByPx;
  const height = map.imageHeight * map.meterByPx;

  const vertices = shape.points.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  let length = 0;

  for (let i = 0; i < vertices.length - 1; i++) {
    const dx = vertices[i + 1].x - vertices[i].x;
    const dy = vertices[i + 1].y - vertices[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length;
}
