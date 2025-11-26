export default function getPointsIn3dFromPointsInBaseMap(pointsInMap, map) {
  // Guard against undefined or null points
  if (!pointsInMap || !Array.isArray(pointsInMap) || pointsInMap.length === 0) {
    return [];
  }

  const points = pointsInMap.map((point) => {
    const { x: nx, y: ny } = point;
    return {
      x: map.imageWidth * map.meterByPx * (nx - 0.5),
      y: -map.imageHeight * map.meterByPx * (ny - 0.5),
    };
  });

  return points;
}
