export default function parsePointsFromNodeToState(
  nodePoints,
  imageSize,
  imagePosition
) {
  const width = imageSize.width;
  const height = imageSize.height;
  const dx = imagePosition?.x || 0;
  const dy = imagePosition?.y || 0;

  let points = [];
  for (let i = 0; i < nodePoints.length - 1; i += 2) {
    const x = (nodePoints[i] - dx) / width;
    const y = (nodePoints[i + 1] - dy) / height;
    points.push({x: nodePoints[i], y: nodePoints[i + 1]});
  }
  return points;
}
