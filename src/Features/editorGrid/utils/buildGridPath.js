import { getGridAxes, toGrid, fromGrid } from "./gridAxes";

// Above this number of lines the grid is not drawn (safety net: the callers
// already cull to the visible area and hide too-dense grids — a fixed grid
// at its densest, 6 px cells over two viewports, stays well under).
const MAX_LINES = 3000;

const EMPTY = { minor: "", major: "" };

// SVG paths of the editor grid in base-map local px, covering the base map
// extent ∩ the region to draw (`viewBox`: {x, y, width, height}, null = no
// culling). Same frame as getGridSnap (utils/gridAxes.js): bottom-left corner
// of the base map, turned by `angleDeg` (ortho snap angle).
// One line out of `majorEvery` (counted from the grid origin) goes to the
// `major` path — the main grid —, the others to `minor`.
//
// With a rotated grid the lines span the bounding box of the region IN THE
// GRID FRAME, so they overflow the base map: the caller must clip them to
// its extent.
//
// @returns { minor, major } path `d` strings ("" when nothing to draw)
export default function buildGridPath({
  cellPx,
  imageSize,
  viewBox,
  majorEvery = 1,
  angleDeg = 0,
}) {
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!(cellPx > 0) || !(width > 0) || !(height > 0)) return EMPTY;

  let x0 = 0;
  let x1 = width;
  let y0 = 0;
  let y1 = height;
  if (viewBox) {
    x0 = Math.max(x0, viewBox.x);
    x1 = Math.min(x1, viewBox.x + viewBox.width);
    y0 = Math.max(y0, viewBox.y);
    y1 = Math.min(y1, viewBox.y + viewBox.height);
  }
  if (!(x1 > x0) || !(y1 > y0)) return EMPTY;

  // bounding box of the region in the grid frame
  const axes = getGridAxes({ imageSize, angleDeg });
  const corners = [
    toGrid(axes, { x: x0, y: y0 }),
    toGrid(axes, { x: x1, y: y0 }),
    toGrid(axes, { x: x1, y: y1 }),
    toGrid(axes, { x: x0, y: y1 }),
  ];
  const uMin = Math.min(...corners.map((c) => c.u));
  const uMax = Math.max(...corners.map((c) => c.u));
  const vMin = Math.min(...corners.map((c) => c.v));
  const vMax = Math.max(...corners.map((c) => c.v));

  // tiny tolerance so a line lying exactly on an edge is not lost to
  // floating-point noise
  const eps = 1e-6;
  const iMin = Math.ceil(uMin / cellPx - eps);
  const iMax = Math.floor(uMax / cellPx + eps);
  const jMin = Math.ceil(vMin / cellPx - eps);
  const jMax = Math.floor(vMax / cellPx + eps);
  const count = Math.max(0, iMax - iMin + 1) + Math.max(0, jMax - jMin + 1);
  if (count === 0 || count > MAX_LINES) return EMPTY;

  const every = Math.max(1, Math.round(majorEvery) || 1);
  const round = (n) => Math.round(n * 100) / 100;
  const segment = (a, b) =>
    `M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}`;

  let minor = "";
  let major = "";
  for (let i = iMin; i <= iMax; i++) {
    const u = i * cellPx;
    const d = segment(fromGrid(axes, u, vMin), fromGrid(axes, u, vMax));
    if (i % every === 0) major += d;
    else minor += d;
  }
  for (let j = jMin; j <= jMax; j++) {
    const v = j * cellPx;
    const d = segment(fromGrid(axes, uMin, v), fromGrid(axes, uMax, v));
    if (j % every === 0) major += d;
    else minor += d;
  }
  return { minor, major };
}
