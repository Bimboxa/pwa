// Snap of a point on the editor grid, in base-map local px.
//
// The grid is anchored on the BOTTOM-LEFT corner of the base map (plan
// convention: origin bottom-left, Y up): vertical lines at x = i × cellPx,
// horizontal lines at y = imageSize.height − j × cellPx. It only exists over
// the base map extent.
//
// Each axis snaps on its own: near a vertical line only x is corrected, near
// a horizontal line only y, near a node both.
//
// @returns null | { x, y, snappedX, snappedY }
export default function getGridSnap({ point, cellPx, imageSize, threshold }) {
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!point || !(cellPx > 0) || !(width > 0) || !(height > 0)) return null;
  if (!(threshold > 0)) return null;
  if (
    point.x < -threshold ||
    point.x > width + threshold ||
    point.y < -threshold ||
    point.y > height + threshold
  ) {
    return null;
  }

  const gridX = Math.round(point.x / cellPx) * cellPx;
  const gridY = height - Math.round((height - point.y) / cellPx) * cellPx;

  const snappedX =
    gridX >= 0 && gridX <= width && Math.abs(gridX - point.x) <= threshold;
  const snappedY =
    gridY >= 0 && gridY <= height && Math.abs(gridY - point.y) <= threshold;
  if (!snappedX && !snappedY) return null;

  return {
    x: snappedX ? gridX : point.x,
    y: snappedY ? gridY : point.y,
    snappedX,
    snappedY,
  };
}
