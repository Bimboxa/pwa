import { BASE_MAPS_GRID_GAP } from "./getBaseMapsGridAutoLayout";

// Rows read from a free (hand-made) arrangement of the sheets: sheets are
// swept top to bottom, a sheet whose centre lies below the bottom of the
// current row's first sheet starts a new row; each row is then sorted left to
// right. Pure.
//
// sheets: [{ id, x, y, width, height }]. Returns [[sheet, ...], ...].
export function getSheetsRows(sheets) {
  if (!sheets?.length) return [];
  const sorted = [...sheets].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2)
  );

  const rows = [];
  let row = null;
  let rowBottom = -Infinity;
  sorted.forEach((sheet) => {
    const centerY = sheet.y + sheet.height / 2;
    if (!row || centerY > rowBottom) {
      row = [];
      rows.push(row);
      rowBottom = sheet.y + sheet.height;
    }
    row.push(sheet);
  });

  rows.forEach((r) => r.sort((a, b) => a.x - b.x));
  return rows;
}

// Tidies a hand-made arrangement WITHOUT changing its reading: same rows,
// same order in each row, but tops aligned per row and a constant gap between
// sheets and between rows. Anchored on the top-left corner of the current
// arrangement. Returns { [id]: { x, y } }.
export default function getAlignedSheetsLayout({
  sheets,
  gap = BASE_MAPS_GRID_GAP,
}) {
  const positions = {};
  const rows = getSheetsRows(sheets);
  if (!rows.length) return positions;

  const originX = Math.min(...sheets.map((s) => s.x));
  let y = Math.min(...sheets.map((s) => s.y));

  rows.forEach((row) => {
    let x = originX;
    let rowHeight = 0;
    row.forEach((sheet) => {
      positions[sheet.id] = { x, y };
      x += sheet.width + gap;
      rowHeight = Math.max(rowHeight, sheet.height);
    });
    y += rowHeight + gap;
  });

  return positions;
}
