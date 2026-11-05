import { getGridAxes, toGrid, fromGrid } from "./gridAxes";

// Tolerance (local px) when checking that a snapped point is still on the
// base map: the grid only exists over its extent.
const EDGE_EPSILON = 0.5;

// Snap of a point on the editor grid, in base-map local px.
//
// The grid frame (utils/gridAxes.js) is anchored on the bottom-left corner
// of the base map and turned by the ortho snap angle (`angleDeg`).
//
// Each grid axis snaps on its own: near a line of one family only that
// coordinate is corrected, near a node both.
//
// @returns null | { x, y, snappedU, snappedV }
export default function getGridSnap({
  point,
  cellPx,
  imageSize,
  threshold,
  angleDeg = 0,
}) {
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

  const axes = getGridAxes({ imageSize, angleDeg });
  const { u, v } = toGrid(axes, point);
  const gridU = Math.round(u / cellPx) * cellPx;
  const gridV = Math.round(v / cellPx) * cellPx;
  const snappedU = Math.abs(gridU - u) <= threshold;
  const snappedV = Math.abs(gridV - v) <= threshold;
  if (!snappedU && !snappedV) return null;

  const snapped = fromGrid(axes, snappedU ? gridU : u, snappedV ? gridV : v);
  if (
    snapped.x < -EDGE_EPSILON ||
    snapped.x > width + EDGE_EPSILON ||
    snapped.y < -EDGE_EPSILON ||
    snapped.y > height + EDGE_EPSILON
  ) {
    return null;
  }

  return { x: snapped.x, y: snapped.y, snappedU, snappedV };
}
