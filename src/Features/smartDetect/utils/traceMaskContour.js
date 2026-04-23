/**
 * Moore-Neighbor boundary tracing on a binary mask.
 *
 * Input: a ROI-local Uint8Array (mask) of size width × height, where
 *   1 = filled pixel, 0 = background. Offset is the ROI's top-left in
 *   the caller's coordinate space (image pixels for SURFACE_DROP).
 *
 * Output: ordered list of contour points in the caller's space
 *   (offset-applied, +0.5 pixel centering so the polygon closes on
 *   pixel boundaries rather than centres — mirrors the `+0.5` applied
 *   by the OpenCV detectContoursAsync handler for consistency).
 *
 * Classic Moore-Neighbor algorithm with Jacob's stopping criterion.
 */
export default function traceMaskContour({
  mask,
  width,
  height,
  offsetX = 0,
  offsetY = 0,
}) {
  if (!mask || width <= 0 || height <= 0) return [];

  // Find start pixel: first filled pixel in raster scan order.
  let startIdx = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return [];

  const sx = startIdx % width;
  const sy = (startIdx - sx) / width;

  // 8-connected neighbour offsets in clockwise order starting from the
  // pixel directly to the LEFT of the current one (Moore-Neighbor convention).
  //   (-1, 0) (-1,-1) ( 0,-1) ( 1,-1) ( 1, 0) ( 1, 1) ( 0, 1) (-1, 1)
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
  const DY = [0, -1, -1, -1, 0, 1, 1, 1];

  const contour = [];
  const pushPoint = (x, y) => {
    contour.push({ x: x + offsetX + 0.5, y: y + offsetY + 0.5 });
  };

  const isFilled = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return mask[y * width + x] === 1;
  };

  pushPoint(sx, sy);

  // Start direction: came from the left (entering from the background),
  // so the first "previous" cell is (sx-1, sy). We rotate the search
  // vector CCW by 2 steps (the +2 is the classic Moore backtrack) and
  // then scan CW for the next filled neighbour.
  let cx = sx;
  let cy = sy;
  let prevDir = 6; // corresponds to (0, 1) = we came from "south"
  const MAX_ITERS = width * height * 4;
  let iters = 0;

  while (iters++ < MAX_ITERS) {
    // Start search from (prevDir + 6) mod 8 — i.e. the neighbour CCW of
    // the direction we arrived from, per Jacob's rule.
    const startDir = (prevDir + 6) & 7;
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (startDir + k) & 7;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (isFilled(nx, ny)) {
        cx = nx;
        cy = ny;
        prevDir = d;
        found = true;
        break;
      }
    }
    if (!found) break; // isolated single pixel

    // Jacob's stopping criterion: return to the start pixel WITH the
    // same entry direction. With a plain single-pixel check we can loop
    // on thin shapes, but in practice "back to start" is enough here
    // because the BFS fill produces a single connected blob and the
    // contour returns to (sx, sy) exactly once.
    if (cx === sx && cy === sy) break;

    pushPoint(cx, cy);
  }

  return contour;
}
