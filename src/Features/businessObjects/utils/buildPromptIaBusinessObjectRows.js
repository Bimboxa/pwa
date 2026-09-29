import { generateNKeysBetween } from "fractional-indexing";

import { DEFAULT_BUSINESS_OBJECT_COLOR } from "../constants/businessObjectEntityModel.js";

// The tree sorts siblings with localeCompare, which does not follow the
// base-62 order of the default keys ("aZ" vs "aa"): digit-only keys sort the
// same way in both, whatever the number of siblings, and stay valid bounds
// for the later generateKeyBetween calls.
const SORT_INDEX_DIGITS = "0123456789";

/**
 * Items of parsePromptIaBusinessObjects → db.businessObjects rows of a
 * listing. Author refs never reach the database: every row gets a fresh id
 * and the parent links follow. Siblings keep the items order (sortIndex).
 *
 * `code` / `refQty` keep the source document's article number and quantity;
 * `unit` is the source unit, as written.
 *
 * @param {{listing: Object, items: Array, newId: () => string}} params
 * @returns {Array<Object>} rows, parents before children
 */
export default function buildPromptIaBusinessObjectRows({
  listing,
  items,
  newId,
}) {
  const idByRef = new Map();
  (items ?? []).forEach((item) => idByRef.set(item.ref, newId()));

  const rows = (items ?? []).map((item) => ({
    id: idByRef.get(item.ref),
    listingId: listing.id,
    projectId: listing.projectId,
    scopeId: listing.scopeId,
    parentId:
      item.parentRef != null ? (idByRef.get(item.parentRef) ?? null) : null,
    label: item.label,
    color: DEFAULT_BUSINESS_OBJECT_COLOR,
    unit: item.isTitle ? null : (item.unit ?? null),
    ...(item.isTitle ? { isTitle: true } : {}),
    ...(item.code ? { code: item.code } : {}),
    ...(item.refQty != null ? { refQty: item.refQty } : {}),
    ...(item.description ? { description: item.description } : {}),
    sortIndex: null,
  }));

  const rowsByParentId = new Map();
  rows.forEach((row) => {
    const key = row.parentId ?? "";
    if (!rowsByParentId.has(key)) rowsByParentId.set(key, []);
    rowsByParentId.get(key).push(row);
  });
  for (const siblings of rowsByParentId.values()) {
    const keys = generateNKeysBetween(
      null,
      null,
      siblings.length,
      SORT_INDEX_DIGITS
    );
    siblings.forEach((row, i) => {
      row.sortIndex = keys[i];
    });
  }

  return rows;
}
