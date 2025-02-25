export default function getSegmentNodeDistance(segmentNode) {
  if (!segmentNode) return 0;

  const points = segmentNode.points();
  const x1 = points[0];
  const y1 = points[1];
  const x2 = points[2];
  const y2 = points[3];

  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
