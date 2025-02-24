export default function parseShapeForMapEditor(shape) {
  return {
    ...shape,
    points: shape.points.map((point) => ({
      x: point.x * 5,
      y: point.y * 5,
    })),
  };
}
