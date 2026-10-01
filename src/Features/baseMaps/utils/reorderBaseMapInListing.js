import { generateKeyBetween } from "fractional-indexing";

import ensureBaseMapSortIndexes from "./ensureBaseMapSortIndexes";

/**
 * Moves `baseMap` to the position of `overBaseMapId` inside its listing, by
 * rewriting its fractional `sortIndex` only (useBaseMaps sorts on it).
 * `group` = EVERY base map of the listing, in display order — not a filtered
 * view, the new key is computed against the real neighbours.
 * Shared by the BaseMaps module tree and the "Fonds de plan" list.
 */
export default async function reorderBaseMapInListing({
  baseMap,
  overBaseMapId,
  group,
  listing,
  updateEntity,
}) {
  const ids = group.map((bm) => bm.id);
  const oldIndex = ids.indexOf(baseMap.id);
  const newIndex = ids.indexOf(overBaseMapId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

  const sortIndices = await ensureBaseMapSortIndexes(
    group,
    listing,
    updateEntity
  );

  let newSortIndex;
  if (oldIndex < newIndex) {
    // moving down: land right after the hovered row
    const b = sortIndices[newIndex];
    const a = newIndex + 1 < group.length ? sortIndices[newIndex + 1] : null;
    newSortIndex = generateKeyBetween(b, a);
  } else {
    // moving up: land right before the hovered row
    const b = newIndex > 0 ? sortIndices[newIndex - 1] : null;
    const a = sortIndices[newIndex];
    newSortIndex = generateKeyBetween(b, a);
  }

  await updateEntity(baseMap.id, { sortIndex: newSortIndex }, { listing });
}
