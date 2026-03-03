import getAnnotationBBox from "./getAnnotationBbox";

/**
 * Returns true when an annotation's bounding box intersects the given viewBox.
 * Both the annotation coordinates and the viewBox must be in the same
 * coordinate space (absolute image pixels — i.e. annotations already resolved
 * by useAnnotationsV2).
 */
function annotationIntersectsViewBox(annotation, viewBox) {
  const bbox = getAnnotationBBox(annotation);
  if (!bbox) return true; // unknown shape → keep

  return (
    bbox.x + bbox.width >= viewBox.x &&
    bbox.x <= viewBox.x + viewBox.width &&
    bbox.y + bbox.height >= viewBox.y &&
    bbox.y <= viewBox.y + viewBox.height
  );
}

/**
 * Filters an array of resolved annotations, keeping only those whose bounding
 * box intersects the container viewBox.
 *
 * @param {Array}  annotations  Annotations with pixel-resolved coordinates
 *                              (as returned by useAnnotationsV2).
 * @param {Object} viewBox      { x, y, width, height } in absolute image pixels.
 * @returns {Array} Filtered annotations.
 */
export default function filterAnnotationsByViewBox(annotations, viewBox) {
  if (!annotations) return annotations;
  if (!viewBox) return annotations;
  return annotations.filter((a) => annotationIntersectsViewBox(a, viewBox));
}
