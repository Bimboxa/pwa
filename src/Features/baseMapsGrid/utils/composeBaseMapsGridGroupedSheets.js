import {
  ADD_SHEET_ID,
  ADD_SHEET_SIZE,
} from "../constants/baseMapsGridConstants";

import getBaseMapSheet from "./getBaseMapSheet";
import getBaseMapsGridAutoLayout, {
  BASE_MAPS_GRID_GAP,
} from "./getBaseMapsGridAutoLayout";
import getAlignedSheetsLayout, {
  getSheetsRows,
} from "./getAlignedSheetsLayout";

// Left gutter of a group: its label (eye + folder name), then a vertical
// bar running along its sheets. Paper points.
export const GROUP_LABEL_HEIGHT = 40;
export const GROUP_LABEL_WIDTH = 480;
// bar: gap to the label on its left, to the sheets on its right
const GROUP_BAR_GAP = 40;
// room under the sheets for their names (see BaseMapSheetSvg)
const SHEET_NAME_HEIGHT = 40;
const GROUP_GAP = 150;

export function getAddSheetId(listingId) {
  return `${ADD_SHEET_ID}:${listingId}`;
}

export function isAddSheetId(sheetId) {
  return typeof sheetId === "string" && sheetId.startsWith(ADD_SHEET_ID);
}

// Sheets of the 2D table, GROUPED BY FOLDER (getBaseMapsGridGroups): the
// groups are stacked top to bottom, each one laid in rows, its label at its
// top left and a vertical bar along its sheets. Positions are in paper points; the hand-made ones (`positions`, see
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
//   groupLabels: [{ id, name, x, y, hidden, count, bar }]  (x, y: top-RIGHT
//     of the label, which is right-aligned next to the bar; bar: { x, y1,
//     y2 } | null when the group lays no sheet)
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
  // a group laying no sheet (hidden) keeps the column of the previous one
  let lastLeft = 0;

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
    if (!hidden) {
      sized.forEach(({ baseMap, sheet }) => {
        const slot = auto[baseMap.id];
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
        let position = { x: slot.x, y: y + slot.y };
        // Hand-made arrangement: the default slot could lie under a moved
        // sheet, the frame goes at the end of the last row instead.
        if (sized.some(({ baseMap }) => storedPositions[baseMap.id])) {
          const lastRow = getSheetsRows(rects).at(-1);
          position = {
            x:
              Math.max(...lastRow.map((r) => r.x + r.width)) +
              BASE_MAPS_GRID_GAP,
            y: Math.min(...lastRow.map((r) => r.y)),
          };
        }
        const placed = {
          id,
          listingId: group.listingId,
          ...ADD_SHEET_SIZE,
          ...position,
        };
        rects.push(placed);
        addSheets.push(placed);
      }
    }

    // the label and the bar follow the sheets where they actually lie
    const hasRects = rects.length > 0;
    const left = hasRects ? Math.min(...rects.map((r) => r.x)) : lastLeft;
    lastLeft = left;
    const top = hasRects ? Math.min(...rects.map((r) => r.y)) : y;
    const bottom = hasRects
      ? Math.max(...rects.map((r) => r.y + r.height)) + SHEET_NAME_HEIGHT
      : y;
    groupLabels.push({
      id: group.id,
      name: group.name,
      hidden,
      count: sized.length,
      x: left - 2 * GROUP_BAR_GAP,
      y: top,
      bar: hasRects ? { x: left - GROUP_BAR_GAP, y1: top, y2: bottom } : null,
    });

    // The next group goes under where this one ACTUALLY lies: sheets moved by
    // hand (a group tidied on one row, pushed down…) never leave a hole, and
    // are never covered by the next group.
    y =
      (hasRects ? bottom : y + GROUP_LABEL_HEIGHT) +
      (hasRects ? GROUP_GAP : BASE_MAPS_GRID_GAP);
  });

  return { items, addSheets, groupLabels };
}

// « Aligner »: tidies the hand-made arrangement group by group (same rows,
// same order in each row — getAlignedSheetsLayout) AND restacks the groups
// under one another, left-aligned, with the spacing of the auto layout — so
// a group tidied on fewer rows pulls the next ones up. Pure.
//
// groupLabels: the labels of the table, in order (hidden groups keep the
//   room of their label).
// items: [{ sheet, groupId }] as returned by the compose above.
// Returns { [baseMapId]: { x, y } }.
export function getAlignedGroupsLayout({ groupLabels, items, addSheets }) {
  // groups closed by a "+" frame (laid by the compose, never stored)
  const addGroupIdSet = new Set((addSheets ?? []).map((s) => s.listingId));
  const sheetsByGroupId = {};
  (items ?? []).forEach((item) => {
    if (!sheetsByGroupId[item.groupId]) sheetsByGroupId[item.groupId] = [];
    sheetsByGroupId[item.groupId].push(item.sheet);
  });
  const allSheets = (items ?? []).map((item) => item.sheet);
  if (allSheets.length === 0) return {};

  const originX = Math.min(...allSheets.map((s) => s.x));
  let y = Math.min(...allSheets.map((s) => s.y));
  const positions = {};

  (groupLabels ?? []).forEach((label) => {
    const sheets = sheetsByGroupId[label.id];
    const withAdd = addGroupIdSet.has(label.id);
    if (!sheets?.length) {
      // empty folder: its "+" frame; hidden group: the room of its label
      y += withAdd
        ? ADD_SHEET_SIZE.height + SHEET_NAME_HEIGHT + GROUP_GAP
        : GROUP_LABEL_HEIGHT + BASE_MAPS_GRID_GAP;
      return;
    }
    const aligned = getAlignedSheetsLayout({ sheets });
    const left = Math.min(...sheets.map((s) => aligned[s.id].x));
    const top = Math.min(...sheets.map((s) => aligned[s.id].y));
    let bottom = y;
    let lastRowTop = y;
    sheets.forEach((sheet) => {
      const position = {
        x: aligned[sheet.id].x - left + originX,
        y: aligned[sheet.id].y - top + y,
      };
      positions[sheet.id] = position;
      bottom = Math.max(bottom, position.y + sheet.height);
      lastRowTop = Math.max(lastRowTop, position.y);
    });
    // the "+" frame closes the last row
    if (withAdd) bottom = Math.max(bottom, lastRowTop + ADD_SHEET_SIZE.height);
    y = bottom + SHEET_NAME_HEIGHT + GROUP_GAP;
  });

  return positions;
}
