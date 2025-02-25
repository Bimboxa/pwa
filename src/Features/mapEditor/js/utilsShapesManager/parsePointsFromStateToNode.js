export default function parsePointsFromStateToNode(
  points,
  imageSize,
  imagePosition
) {
  const width = imageSize.width;
  const height = imageSize.height;
  const dx = imagePosition?.x || 0;
  const dy = imagePosition?.y || 0;

  let nodePoints = [];
  for (let i = 0; i < points.length; i += 1) {
    nodePoints.push(points[i].x * width + dx, points[i].y * height + dy);
  }
  return nodePoints;
}
