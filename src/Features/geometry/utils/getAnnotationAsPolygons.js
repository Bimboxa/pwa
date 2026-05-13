import getPolylineContourPoints from "Features/geometry/utils/getPolylineContourPoints";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";

/**
 * Convert an annotation (with already pixel-resolved points/cuts) into one or
 * more equivalent polygons. POLYGON is returned as-is; POLYLINE/STRIP are
 * polygonized to a band of width `strokeWidth` (CM converted via meterByPx).
 *
 * @param {Object} annotation                 pixel-resolved annotation
 * @param {{meterByPx?: number}} [options]
 * @returns {Array<{points:Array<{x,y}>, cuts?:Array<{points:Array<{x,y}>}>}>}
 */
export default function getAnnotationAsPolygons(annotation, options = {}) {
  if (!annotation) return [];
  const { meterByPx } = options;
  const type = annotation.type;

  if (type === "POLYGON") {
    const points = annotation.points ?? [];
    if (points.length < 3) return [];
    return [{ points, cuts: annotation.cuts ?? [] }];
  }

  if (type === "STRIP") {
    return getStripePolygons(annotation, meterByPx, true);
  }

  if (type === "POLYLINE") {
    const points = annotation.points ?? [];
    if (points.length < 2) return [];
    const strokeWidth = Number(annotation.strokeWidth) || 0;
    if (strokeWidth <= 0) return [];
    const isCmUnit = annotation.strokeWidthUnit === "CM" && meterByPx > 0;
    const strokeWidthPx = isCmUnit
      ? (strokeWidth * 0.01) / meterByPx
      : strokeWidth;
    const contour = getPolylineContourPoints(points, strokeWidthPx);
    if (!contour || contour.length < 3) return [];
    return [{ points: contour, cuts: [] }];
  }

  return [];
}
