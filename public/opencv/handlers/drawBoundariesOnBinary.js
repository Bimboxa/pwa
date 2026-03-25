/**
 * Draw existing polygon annotations onto a binary Mat as filled black regions.
 * Called before flood fill so that existing annotations act as barriers
 * and the fill cannot overlap them.
 *
 * Polygons are filled (not stroked) to avoid visible gaps between
 * the filled region and the annotation.
 *
 * @param {cv.Mat} binaryMat - The processed binary image (modified in place).
 *   White (255) = fillable area, black (0) = wall/barrier.
 * @param {Array<{points: Array<{x: number, y: number}>}>} boundaries
 *   Each boundary has pixel-coordinate points representing a closed polygon.
 * @param {Function} track - Mat tracker for cleanup (registers Mats for later deletion).
 */
function drawBoundariesOnBinary(binaryMat, boundaries, track) {
  if (!boundaries || boundaries.length === 0) return;

  const black = new cv.Scalar(0);

  for (const boundary of boundaries) {
    const pts = boundary.points;
    if (!pts || pts.length < 3) continue;

    const flat = new Int32Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) {
      flat[i * 2] = Math.round(pts[i].x);
      flat[i * 2 + 1] = Math.round(pts[i].y);
    }

    const mat = track(cv.matFromArray(pts.length, 1, cv.CV_32SC2, flat));
    const vec = track(new cv.MatVector());
    vec.push_back(mat);

    cv.fillPoly(binaryMat, vec, black);
  }
}
