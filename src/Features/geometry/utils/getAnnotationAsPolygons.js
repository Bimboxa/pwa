import polygonClipping from "polygon-clipping";

import getPolylineContourPoints from "Features/geometry/utils/getPolylineContourPoints";
import getStripePolygons from "Features/geometry/utils/getStripePolygons";
import offsetPolygon from "Features/geometry/utils/offsetPolygon";
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

    // Closed centerline (closeLine flag or implicit last == first): the band
    // is an annulus around the ring — outer/inner offsets at ±w/2.
    // getPolylineContourPoints only handles OPEN centerlines: it would skip
    // the closing segment and leave a gap in the band.
    let centerline = points;
    let isClosed = !!annotation.closeLine;
    if (!isClosed && points.length >= 4) {
      const first = points[0];
      const last = points[points.length - 1];
      if (first.x === last.x && first.y === last.y) {
        isClosed = true;
        centerline = points.slice(0, -1);
      }
    }
    if (isClosed && centerline.length >= 3) {
      const shapes = getClosedPolylineBand(centerline, strokeWidthPx);
      if (shapes) return shapes;
      // degenerate offsets → fall back to the open contour below
    }

    const contour = getPolylineContourPoints(
      expandArcsInPath(points, ARC_SAMPLES, false),
      strokeWidthPx
    );
    if (!contour || contour.length < 3) return [];
    return [{ points: contour, cuts: [] }];
  }

  return [];
}

// Annular band of a CLOSED polyline centerline: xor of the ±w/2 offset rings
// (same approach as getClosedStripPolygon). Returns every band polygon so a
// self-intersecting centerline still yields a complete footprint, or null
// when the offsets are degenerate.
function getClosedPolylineBand(centerline, strokeWidthPx) {
  const ring = expandArcsInPath(centerline, ARC_SAMPLES, true);
  const half = strokeWidthPx / 2;
  const outer = offsetPolygon(ring, half);
  const inner = offsetPolygon(ring, -half);
  if (!outer || outer.length < 3 || !inner || inner.length < 3) return null;

  const toGeoRing = (pts) => {
    const geoRing = pts.map((p) => [p.x, p.y]);
    const first = geoRing[0];
    const last = geoRing[geoRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) geoRing.push([...first]);
    return geoRing;
  };
  const fromGeoRing = (geoRing) =>
    geoRing.slice(0, -1).map(([x, y]) => ({ x, y }));

  try {
    const band = polygonClipping.xor(
      [[toGeoRing(outer)]],
      [[toGeoRing(inner)]]
    );
    const shapes = band
      .map((poly) => ({
        points: fromGeoRing(poly[0]),
        cuts: poly.slice(1).map((r) => ({ points: fromGeoRing(r) })),
      }))
      .filter((s) => s.points.length >= 3);
    if (shapes.length > 0) return shapes;
  } catch (e) {
    console.error("getClosedPolylineBand error:", e);
  }
  // xor failed → coarse fallback: outer ring with the inner ring as a hole
  return [{ points: outer, cuts: [{ points: inner }] }];
}
