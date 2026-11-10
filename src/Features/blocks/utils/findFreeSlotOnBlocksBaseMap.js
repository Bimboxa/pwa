// Free spot for a new block on a blocks base map.
//
// Scans the page row by row (left → right, top → bottom) and returns the
// CENTER of the first rectangle of `size` that stays inside the page and
// away from every occupied box by at least `margin`. All values in the
// pixels of the blocks base map.
//
//   occupiedBoxes: [{x, y, width, height}] — what is already drawn
//   size: {width, height} of the block to place
//   pageSize: {width, height} of the base map image
//   margin: clearance around the block and from the page border
//   step: scan step (defaults to margin)
//
// Returns {x, y}, or null when the page has no room left (the caller then
// creates another blocks base map). An oversized block (larger than the
// page) never fits either.
//
// Pure: node-testable.
export default function findFreeSlotOnBlocksBaseMap({
  occupiedBoxes,
  size,
  pageSize,
  margin = 0,
  step,
}) {
  const width = Number(size?.width) || 0;
  const height = Number(size?.height) || 0;
  const pageWidth = Number(pageSize?.width) || 0;
  const pageHeight = Number(pageSize?.height) || 0;
  if (!(pageWidth > 0) || !(pageHeight > 0)) return null;

  const maxX = pageWidth - margin - width;
  const maxY = pageHeight - margin - height;
  if (maxX < margin || maxY < margin) return null;

  const scanStep = step > 0 ? step : Math.max(margin, 1);
  const boxes = (occupiedBoxes ?? []).filter(
    (b) =>
      b &&
      Number.isFinite(b.x) &&
      Number.isFinite(b.y) &&
      Number.isFinite(b.width) &&
      Number.isFinite(b.height)
  );

  const isFree = (x, y) =>
    boxes.every(
      (b) =>
        x + width + margin <= b.x ||
        b.x + b.width + margin <= x ||
        y + height + margin <= b.y ||
        b.y + b.height + margin <= y
    );

  for (let y = margin; y <= maxY; y += scanStep) {
    for (let x = margin; x <= maxX; x += scanStep) {
      if (isFree(x, y)) return { x: x + width / 2, y: y + height / 2 };
    }
  }
  return null;
}
