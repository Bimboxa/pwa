// Default placement of the sheets on the table: rows of `columns` sheets,
// each row as tall as its tallest sheet. Sizes and positions are in paper
// points (the grid world unit). Pure.
//
// sheets: [{ id, width, height }] in display order.
// Returns { [id]: { x, y } } (top-left corner of each sheet).

export const BASE_MAPS_GRID_GAP = 80;

export default function getBaseMapsGridAutoLayout({
  sheets,
  gap = BASE_MAPS_GRID_GAP,
  columns,
}) {
  const positions = {};
  if (!sheets?.length) return positions;

  const columnsCount =
    columns > 0 ? columns : Math.ceil(Math.sqrt(sheets.length));

  let x = 0;
  let y = 0;
  let rowHeight = 0;

  sheets.forEach((sheet, index) => {
    if (index > 0 && index % columnsCount === 0) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    positions[sheet.id] = { x, y };
    x += sheet.width + gap;
    rowHeight = Math.max(rowHeight, sheet.height);
  });

  return positions;
}
