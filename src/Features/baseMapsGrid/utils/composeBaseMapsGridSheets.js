import {
  ADD_SHEET_ID,
  ADD_SHEET_SIZE,
} from "../constants/baseMapsGridConstants";

import getBaseMapSheet from "./getBaseMapSheet";
import getBaseMapsGridAutoLayout, {
  BASE_MAPS_GRID_GAP,
} from "./getBaseMapsGridAutoLayout";
import { getSheetsRows } from "./getAlignedSheetsLayout";

// Sheets of a listing laid on the table, shared by the 2D grid and the 3D
// grid (same arrangement in both). Positions are in paper points: the
// hand-made ones (`positions`, see useBaseMapsGridLayout) win over the auto
// layout. Pure.
//
// Returns { items: [{ baseMap, sheet }], addSheet } — `addSheet` is the "+"
// placeholder frame closing the grid.
export default function composeBaseMapsGridSheets({
  baseMaps,
  listingId,
  positions,
}) {
  const storedPositions = positions ?? {};
  const listingBaseMaps =
    baseMaps?.filter((baseMap) => baseMap.listingId === listingId) ?? [];
  const sized = listingBaseMaps
    .map((baseMap) => ({ baseMap, sheet: getBaseMapSheet({ baseMap }) }))
    .filter((item) => item.sheet);
  // The "+" frame takes the slot after the last sheet (bottom-right of
  // the grid).
  const autoPositions = getBaseMapsGridAutoLayout({
    sheets: [
      ...sized.map((item) => item.sheet),
      { id: ADD_SHEET_ID, ...ADD_SHEET_SIZE },
    ],
  });
  const items = sized.map(({ baseMap, sheet }) => {
    const position = storedPositions[baseMap.id] ?? autoPositions[baseMap.id];
    return { baseMap, sheet: { ...sheet, x: position.x, y: position.y } };
  });

  // Hand-made arrangement: the default slot could lie under a moved
  // sheet, the frame goes at the end of the last row instead.
  let addPosition = autoPositions[ADD_SHEET_ID];
  if (sized.some(({ baseMap }) => storedPositions[baseMap.id])) {
    const lastRow = getSheetsRows(items.map((item) => item.sheet)).at(-1);
    addPosition = {
      x: Math.max(...lastRow.map((s) => s.x + s.width)) + BASE_MAPS_GRID_GAP,
      y: Math.min(...lastRow.map((s) => s.y)),
    };
  }

  return {
    items,
    addSheet: { id: ADD_SHEET_ID, ...ADD_SHEET_SIZE, ...addPosition },
  };
}
