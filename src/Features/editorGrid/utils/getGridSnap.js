import { getGridAxes, toGrid, fromGrid } from "./gridAxes";

// Tolerance (local px) when checking that a snapped point is still on the
// base map: the grid only exists over its extent.
const EDGE_EPSILON = 0.5;

// Snap of a point on the editor grid, in base-map local px.
//
// The grid frame (utils/gridAxes.js) is anchored on the centre of the base
// map and turned by the ortho snap angle (`angleDeg`).
//
// Same dynamics as the snap on an existing vertex: only the grid NODES are
// targets, and the nearest one catches the point once it is within
// `threshold` of it (a disc around the node) — no snap on a line alone.
//
// @returns null | { x, y }
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
  if (Math.hypot(gridU - u, gridV - v) > threshold) return null;

  const snapped = fromGrid(axes, gridU, gridV);
  if (
    snapped.x < -EDGE_EPSILON ||
    snapped.x > width + EDGE_EPSILON ||
    snapped.y < -EDGE_EPSILON ||
    snapped.y > height + EDGE_EPSILON
  ) {
    return null;
  }

  return { x: snapped.x, y: snapped.y };
}
