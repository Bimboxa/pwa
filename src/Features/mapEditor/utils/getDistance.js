export default function getDistance(point1, point2) {
  const x1 = point1.x;
  const y1 = point1.y;
  const x2 = point2.x;
  const y2 = point2.y;
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
