import { BASE_MAPS_GRID_GAP } from "Features/baseMapsGrid/utils/getBaseMapsGridAutoLayout";
import { getSheetsRows } from "Features/baseMapsGrid/utils/getAlignedSheetsLayout";

// Sheets laid AROUND one of them: the anchor takes the centre cell of a
// regular grid, the others fill the nearest cells around it (in the reading
// order of their current arrangement). Every cell is as large as the largest
// sheet, each sheet is centred in its cell. Sizes and positions in paper
// points. Pure.
//
// sheets: [{ id, x, y, width, height }]. Returns { [id]: { x, y } } (top-left
// corners, the anchor cell being centred on the origin).
export default function getAroundSheetsLayout({
  sheets,
  anchorId,
  gap = BASE_MAPS_GRID_GAP,
}) {
  const positions = {};
  const anchor = sheets?.find((sheet) => sheet.id === anchorId);
  if (!anchor) return positions;

  const cellWidth = Math.max(...sheets.map((s) => s.width)) + gap;
  const cellHeight = Math.max(...sheets.map((s) => s.height)) + gap;

  // reading order of the current arrangement, anchor excluded
  const others = getSheetsRows(sheets)
    .flat()
    .filter((sheet) => sheet.id !== anchorId);

  // enough rings to host every other sheet: (2r + 1)² - 1 cells
  let rings = 0;
  while ((2 * rings + 1) ** 2 - 1 < others.length) rings += 1;

  const cells = [];
  for (let cy = -rings; cy <= rings; cy += 1) {
    for (let cx = -rings; cx <= rings; cx += 1) {
      if (cx === 0 && cy === 0) continue;
      cells.push({
        cx,
        cy,
        distance: Math.hypot(cx * cellWidth, cy * cellHeight),
      });
    }
  }
  // nearest cells first; ties: right before left, below before above
  cells.sort((a, b) => a.distance - b.distance || b.cx - a.cx || b.cy - a.cy);

  // the retained cells are handed out in reading order (top-left first) so
  // the sheets keep their relative order around the anchor
  const usedCells = cells
    .slice(0, others.length)
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  positions[anchor.id] = { x: -anchor.width / 2, y: -anchor.height / 2 };
  others.forEach((sheet, index) => {
    const cell = usedCells[index];
    positions[sheet.id] = {
      x: cell.cx * cellWidth - sheet.width / 2,
      y: cell.cy * cellHeight - sheet.height / 2,
    };
  });

  return positions;
}
