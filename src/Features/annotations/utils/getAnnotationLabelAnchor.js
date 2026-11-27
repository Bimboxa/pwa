import getBarycenter from "Features/geometry/utils/getBarycenter";

/**
 * Anchor of an annotation's label chip (image px): labelDelta.label / target
 * / elbow are stored relative to it.
 * - POINT / MARKER / DISC: the annotation point.
 * - RECTANGLE (bbox + rotation, no points): the bbox centre, which the
 *   rotation leaves in place.
 * - other types: barycenter of the points.
 * Returns null when the annotation has no usable geometry.
 */
export default function getAnnotationLabelAnchor(annotation) {
  if (!annotation) return null;

  let points = annotation.points;
  if (["POINT", "MARKER", "DISC"].includes(annotation.type)) {
    points = annotation.point ? [annotation.point] : null;
  } else if (annotation.type === "RECTANGLE" && annotation.bbox) {
    const { x, y, width, height } = annotation.bbox;
    points = [x, y, width, height].every(Number.isFinite)
      ? [{ x: x + width / 2, y: y + height / 2 }]
      : null;
  }
  if (!points?.length) return null;

  const anchor = getBarycenter(points);
  return Number.isFinite(anchor?.x) && Number.isFinite(anchor?.y)
    ? anchor
    : null;
}
