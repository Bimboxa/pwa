import {
  ADD_SHEET_ID,
  ADD_SHEET_SIZE,
} from "../constants/baseMapsGridConstants";

import getBaseMapSheet from "./getBaseMapSheet";
import getBaseMapsGridAutoLayout, {
  BASE_MAPS_GRID_GAP,
} from "./getBaseMapsGridAutoLayout";

// Space kept under a group for its label (below the sheet names), and
// between two groups. Paper points.
export const GROUP_LABEL_OFFSET = 78;
export const GROUP_LABEL_HEIGHT = 40;
export const GROUP_LABEL_WIDTH = 520;
const GROUP_GAP = 150;

export function getAddSheetId(listingId) {
  return `${ADD_SHEET_ID}:${listingId}`;
}

export function isAddSheetId(sheetId) {
  return typeof sheetId === "string" && sheetId.startsWith(ADD_SHEET_ID);
}

// Sheets of the 2D table, GROUPED BY FOLDER (getBaseMapsGridGroups): the
// groups are stacked top to bottom, each one laid in rows, its label under
// it. Positions are in paper points; the hand-made ones (`positions`, see
// useBaseMapsGridLayout) win over the auto layout, and the label follows the
// sheets of its group. Pure.
//
// hiddenGroupIds: groups whose sheets are not laid (the label stays, so the
//   group can be shown again).
// addListingIds: folders closing their group with a "+" frame.
//
// Returns {
//   items: [{ baseMap, sheet, groupId }],
//   addSheets: [{ id, listingId, x, y, width, height }],
//   groupLabels: [{ id, name, x, y, hidden, count }]  (y: top of the label)
// }.
export default function composeBaseMapsGridGroupedSheets({
  groups,
  hiddenGroupIds,
  addListingIds,
  positions,
}) {
  const storedPositions = positions ?? {};
  const hiddenIdSet = new Set(hiddenGroupIds ?? []);
  const addIdSet = new Set(addListingIds ?? []);

  const sizedGroups = (groups ?? []).map((group) => ({
    group,
    hidden: hiddenIdSet.has(group.id),
    sized: group.baseMaps
      .map((baseMap) => ({ baseMap, sheet: getBaseMapSheet({ baseMap }) }))
      .filter((item) => item.sheet),
    withAdd: Boolean(group.listingId) && addIdSet.has(group.listingId),
  }));

  // same number of columns for every group, sized on the largest one
  const maxSlots = Math.max(
    1,
    ...sizedGroups.map((g) =>
      g.hidden ? 0 : g.sized.length + (g.withAdd ? 1 : 0)
    )
  );
  const columns = Math.max(2, Math.ceil(Math.sqrt(maxSlots)));

  const items = [];
  const addSheets = [];
  const groupLabels = [];
  let y = 0;

  sizedGroups.forEach(({ group, hidden, sized, withAdd }) => {
    const entries = hidden
      ? []
      : [
          ...sized.map((item) => item.sheet),
          ...(withAdd
            ? [{ id: getAddSheetId(group.listingId), ...ADD_SHEET_SIZE }]
            : []),
        ];
    const auto = getBaseMapsGridAutoLayout({ sheets: entries, columns });

    const rects = [];
    let autoBottom = y;
    if (!hidden) {
      sized.forEach(({ baseMap, sheet }) => {
        const slot = auto[baseMap.id];
        autoBottom = Math.max(autoBottom, y + slot.y + sheet.height);
        const position = storedPositions[baseMap.id] ?? {
          x: slot.x,
          y: y + slot.y,
        };
        const placed = { ...sheet, x: position.x, y: position.y };
        rects.push(placed);
        items.push({ baseMap, sheet: placed, groupId: group.id });
      });
      if (withAdd) {
        const id = getAddSheetId(group.listingId);
        const slot = auto[id];
        const placed = {
          id,
          listingId: group.listingId,
          ...ADD_SHEET_SIZE,
          x: slot.x,
          y: y + slot.y,
        };
        autoBottom = Math.max(autoBottom, placed.y + placed.height);
        rects.push(placed);
        addSheets.push(placed);
      }
    }

    // the label follows the sheets where they actually lie
    const hasRects = rects.length > 0;
    groupLabels.push({
      id: group.id,
      name: group.name,
      hidden,
      count: sized.length,
      x: hasRects ? Math.min(...rects.map((r) => r.x)) : 0,
      y: hasRects
        ? Math.max(...rects.map((r) => r.y + r.height)) + GROUP_LABEL_OFFSET
        : y,
    });

    y =
      (hasRects ? autoBottom + GROUP_LABEL_OFFSET : y) +
      GROUP_LABEL_HEIGHT +
      (hasRects ? GROUP_GAP : BASE_MAPS_GRID_GAP);
  });

  return { items, addSheets, groupLabels };
}
