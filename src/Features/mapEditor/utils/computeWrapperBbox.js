/**
 * Compute the unified bounding box from one or more annotations' resolved points.
 * Points must already be in pixel coordinates (not normalized).
 *
 * When a non-zero rotation is provided, points are un-rotated around the
 * given rotationCenter first so the returned bbox represents the "canonical"
 * (unrotated) shape. The caller is expected to apply the rotation visually
 * (SVG transform).
 *
 * @param {Array} annotations - Annotations with resolved .points [{id, x, y, ...}]
 * @param {number} [rotation=0] - Cumulative rotation in degrees to factor out
 * @param {{ x: number, y: number }} [rotationCenter] - Center of rotation in pixel coords
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
export default function computeWrapperBbox(annotations, rotation = 0, rotationCenter) {
  if (!annotations?.length) return null;

  // 1. Collect all points
  const allPoints = [];

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
        allPoints.push(pt);
      }
    }
  }

  if (allPoints.length === 0) return null;

  // 2. If rotation is non-zero, un-rotate points around the rotation center
  let points = allPoints;

  if (rotation !== 0 && rotationCenter) {
    const { x: cx, y: cy } = rotationCenter;
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    points = allPoints.map(pt => {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    });
  }

  // 3. Compute axis-aligned bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
