// Above this number of lines the grid is not drawn (safety net: the callers
// already cull to the visible box and hide too-dense grids).
const MAX_LINES = 1500;

const EMPTY = { minor: "", major: "" };

// SVG paths of the editor grid in base-map local px, clipped to the base map
// extent and to the visible box (`viewBox`: {x, y, width, height}, null = no
// culling). Same anchoring as getGridSnap: bottom-left corner of the base map.
// One line out of `majorEvery` (counted from that corner) goes to the `major`
// path — the main grid —, the others to `minor`.
//
// @returns { minor, major } path `d` strings ("" when nothing to draw)
export default function buildGridPath({
  cellPx,
  imageSize,
  viewBox,
  majorEvery = 1,
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

  const iMin = Math.ceil(x0 / cellPx);
  const iMax = Math.floor(x1 / cellPx);
  // horizontal lines are counted from the bottom edge
  const jMin = Math.ceil((height - y1) / cellPx);
  const jMax = Math.floor((height - y0) / cellPx);
  const count = Math.max(0, iMax - iMin + 1) + Math.max(0, jMax - jMin + 1);
  if (count === 0 || count > MAX_LINES) return EMPTY;

  const every = Math.max(1, Math.round(majorEvery) || 1);
  const round = (v) => Math.round(v * 100) / 100;
  let minor = "";
  let major = "";
  for (let i = iMin; i <= iMax; i++) {
    const d = `M${round(i * cellPx)} ${round(y0)}V${round(y1)}`;
    if (i % every === 0) major += d;
    else minor += d;
  }
  for (let j = jMin; j <= jMax; j++) {
    const d = `M${round(x0)} ${round(height - j * cellPx)}H${round(x1)}`;
    if (j % every === 0) major += d;
    else minor += d;
  }
  return { minor, major };
}
