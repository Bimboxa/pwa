/**
 * Compute the unified bounding box from one or more annotations' resolved points.
 * Points must already be in pixel coordinates (not normalized).
 *
 * @param {Array} annotations - Annotations with resolved .points [{id, x, y, ...}]
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export default function computeWrapperBbox(annotations) {
  if (!annotations?.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  for (const annotation of annotations) {
    const pointSources = [annotation.points];
    if (annotation.cuts) {
      for (const cut of annotation.cuts) {
        if (cut.points) pointSources.push(cut.points);
      }
    }

    for (const points of pointSources) {
      if (!points) continue;
      for (const pt of points) {
        if (pt.x == null || pt.y == null) continue;
        hasPoints = true;
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
  }

  if (!hasPoints) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
