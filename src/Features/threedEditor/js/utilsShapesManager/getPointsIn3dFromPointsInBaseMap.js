export default function getPointsIn3dFromPointsInBaseMap(pointsInMap, map) {
  const points = pointsInMap.map((point) => {
    const { x: nx, y: ny } = point;
    return {
      x: map.imageWidth * map.meterByPx * (nx - 0.5),
      y: -map.imageHeight * map.meterByPx * (ny - 0.5),
    };
  });

  return points;
}
