import { generateKeyBetween } from "fractional-indexing";

/**
 * Ensures every baseMap of a group (given in display order) has a persisted
 * fractional sortIndex, generating and saving keys for the missing ones.
 * Returns the array of sortIndex keys aligned with the input order.
 */
export default async function ensureBaseMapSortIndexes(
  baseMaps,
  listing,
  updateEntity
) {
  const needsInit = baseMaps.some((bm) => bm.sortIndex == null);
  if (!needsInit) return baseMaps.map((bm) => bm.sortIndex);

  const sortIndices = [];
  let prev = null;
  for (const bm of baseMaps) {
    const idx = bm.sortIndex ?? generateKeyBetween(prev, null);
    sortIndices.push(idx);
    prev = idx;
  }

  await Promise.all(
    baseMaps.map((bm, i) => {
      if (bm.sortIndex == null) {
        return updateEntity(bm.id, { sortIndex: sortIndices[i] }, { listing });
      }
      return null;
    })
  );

  return sortIndices;
}
