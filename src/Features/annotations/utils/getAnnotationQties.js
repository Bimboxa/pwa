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

  const closeLine =
    annotation.closeLine ||
    annotation?.polyline?.closeLine ||
    annotation?.annotationTemplate?.closeLine;

  const lengthPx = getPointsLength(pointsInPx, closeLine);
  let surfacePx = 0;

  if (closeLine && pointsInPx.length >= 3) {
    // Get cuts from annotation if available and convert their points to pixels
    const cutsRaw = annotation.cuts || annotation?.polyline?.cuts || [];
    const cuts = cutsRaw.map((cut) => {
      if (!cut || !Array.isArray(cut.points)) return cut;
      
      // Convert cut points to pixels if needed
      let cutPointsInPx = cut.points;
      if (imageSize?.width && imageSize?.height) {
        cutPointsInPx = cut.points.map((p) => ({
          x: p.x * imageSize.width,
          y: p.y * imageSize.height,
        }));
      }
      
      return {
        ...cut,
        points: cutPointsInPx,
      };
    });
    
    surfacePx = getPointsSurface(pointsInPx, closeLine, cuts);
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
