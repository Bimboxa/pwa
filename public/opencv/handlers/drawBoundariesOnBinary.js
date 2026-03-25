/**
 * Draw annotation boundaries onto a binary Mat as black barriers.
 * Called before flood fill so that existing annotations act as walls
 * and the fill cannot cross them.
 *
 * Uses cv.line() segment-by-segment since cv.polylines() is not
 * available in OpenCV.js.
 *
 * @param {cv.Mat} binaryMat - The processed binary image (modified in place).
 *   White (255) = fillable area, black (0) = wall/barrier.
 * @param {Array<{points: Array<{x: number, y: number}>, closed: boolean}>} boundaries
 *   Each boundary has pixel-coordinate points and a closed flag (polygon vs polyline).
 * @param {number} [thickness=3] - Line thickness in pixels.
 */
function drawBoundariesOnBinary(binaryMat, boundaries, thickness = 3) {
  if (!boundaries || boundaries.length === 0) return;

  const black = new cv.Scalar(0);

  for (const boundary of boundaries) {
    const pts = boundary.points;
    if (!pts || pts.length < 2) continue;

    const count = boundary.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      cv.line(
        binaryMat,
        new cv.Point(Math.round(a.x), Math.round(a.y)),
        new cv.Point(Math.round(b.x), Math.round(b.y)),
        black,
        thickness
      );
    }
  }
}
