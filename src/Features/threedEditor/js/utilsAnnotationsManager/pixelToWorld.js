export default function pixelToWorld(point, baseMap) {
  const { imageWidth, imageHeight, meterByPx } = baseMap;
  return {
    x: (point.x - imageWidth / 2) * meterByPx,
    y: -(point.y - imageHeight / 2) * meterByPx,
  };
}
