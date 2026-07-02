import getPolylineContourPoints from "Features/geometry/utils/getPolylineContourPoints";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Tessellation count for S-C-S arcs — matches getStripePolygons so POLYGON /
// POLYLINE / STRIP footprints follow the curve identically.
const ARC_SAMPLES = 16;

/**
 * Convert an annotation (with already pixel-resolved points/cuts) into one or
 * more equivalent polygons. POLYGON is returned as-is; POLYLINE/STRIP are
 * polygonized to a band of width `strokeWidth` (CM converted via meterByPx).
 * S-C-S arcs are tessellated so the footprint follows the curve, not the
 * chord of the arc's control points.
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
    const expandedPoints = expandArcsInPath(points, ARC_SAMPLES, true);
    const expandedCuts = (annotation.cuts ?? []).map((c) => ({
      ...c,
      points: expandArcsInPath(c.points ?? [], ARC_SAMPLES, true),
    }));
    return [{ points: expandedPoints, cuts: expandedCuts }];
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
    const contour = getPolylineContourPoints(
      expandArcsInPath(points, ARC_SAMPLES, false),
      strokeWidthPx
    );
    if (!contour || contour.length < 3) return [];
    return [{ points: contour, cuts: [] }];
  }

  return [];
}
