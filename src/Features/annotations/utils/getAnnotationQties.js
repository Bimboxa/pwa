import getPointsLength from "Features/geometry/utils/getPointsLength";
import getPointsSurface from "Features/geometry/utils/getPointsSurface";

export default function getAnnotationQties(annotation, baseMap) {
  if (!annotation) return null;

  if (!annotation || !baseMap) {
    return null;
  }

  const { type, points } = annotation;
  if (type !== "POLYLINE" || !Array.isArray(points) || points.length < 2) {
    return { length: 0, surface: 0 };
  }

  const validPoints = points.filter(
    (point) =>
      point && typeof point.x === "number" && typeof point.y === "number"
  );

  if (validPoints.length < 2) {
    return { length: 0, surface: 0 };
  }

  const imageSize = baseMap?.image?.imageSize;

  let pointsInPx = validPoints;
  // const hasRelativeCoords = validPoints.every(
  //   (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
  // );

  if (pointsInPx.length > 0 && imageSize?.width && imageSize?.height) {
    const { width, height } = imageSize;
    pointsInPx = validPoints.map((p) => ({
      x: p.x * width,
      y: p.y * height,
    }));
  }

  const lengthPx = getPointsLength(pointsInPx);
  let surfacePx = 0;

  const closeLine =
    annotation.closeLine ||
    annotation?.polyline?.closeLine ||
    annotation?.annotationTemplate?.closeLine;

  if (closeLine && pointsInPx.length >= 3) {
    surfacePx = getPointsSurface(pointsInPx);
  }

  const meterByPx = baseMap?.meterByPx;

  let length = lengthPx;
  let surface = surfacePx;

  if (meterByPx) {
    length = lengthPx * meterByPx;
    surface = surfacePx * meterByPx * meterByPx;
  }

  return { length, surface };
}
