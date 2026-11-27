import getAnnotationAsPolygons from "Features/geometry/utils/getAnnotationAsPolygons";
import getRectangleCorners from "Features/rectangles/utils/getRectangleCorners";

// Types whose footprint carves the annotation « Évider » is run on.
export const HOLLOW_OUT_CUTTER_TYPES = [
  "POLYGON",
  "POLYLINE",
  "STRIP",
  "DISC",
  "RECTANGLE",
];

// A RECTANGLE (bbox + rotation, no points) as the POLYGON of its 4 corners,
// for the services that only know point-based footprints
// (avoidVisibleAnnotationsService). Other annotations are returned as they are.
export function toHollowOutCutter(annotation) {
  if (annotation?.type !== "RECTANGLE") return annotation;
  const corners = getRectangleCorners(annotation);
  if (!corners) return annotation;
  return { ...annotation, type: "POLYGON", points: corners, cuts: [] };
}

/**
 * Footprint of an annotation cutting in « Évider », as polygons
 * ({points, cuts}, pixel space, arcs tessellated): the footprints of
 * getAnnotationAsPolygons, plus the RECTANGLE (4 corners, rotation applied).
 * RECTANGLE is handled here and not in getAnnotationAsPolygons, which also
 * feeds tools where a rectangle must stay out (draw-time avoid, auto
 * annotations, smart detect).
 *
 * @param {Object} annotation   pixel-resolved annotation
 * @param {{meterByPx?: number}} [options]
 */
export default function getHollowOutCutterFootprints(annotation, options) {
  return getAnnotationAsPolygons(toHollowOutCutter(annotation), options).filter(
    (shape) => shape?.points?.length >= 3
  );
}
