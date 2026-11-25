import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

/**
 * Ensures every baseMap of a group (given in display order) has a persisted
 * fractional sortIndex, strictly increasing along that order. Returns the
 * array of sortIndex keys aligned with the input order.
 *
 * The keys are read from the DB rows: the hydrated BaseMap instances do not
 * carry `sortIndex`. A group with a missing key or a tie is fully re-ranked
 * (a partial fill could not stay monotonic).
 *
 * The write targets the `baseMaps` table whatever `listing.table` says: some
 * base map folders (imports, older data) have no `table`, and updateEntity
 * would then write nowhere.
 */
export default async function ensureBaseMapSortIndexes(
  baseMaps,
  listing,
  updateEntity
) {
  const records = await db.baseMaps.bulkGet(baseMaps.map((bm) => bm.id));
  const current = records.map((r) => r?.sortIndex ?? null);

  const isValid = current.every(
    (key, i) => key != null && (i === 0 || current[i - 1] < key)
  );
  if (isValid) return current;

  const sortIndices = [];
  let prev = null;
  for (let i = 0; i < baseMaps.length; i++) {
    prev = generateKeyBetween(prev, null);
    sortIndices.push(prev);
  }

  const baseMapsListing = { ...listing, table: "baseMaps" };
  await Promise.all(
    baseMaps.map((bm, i) =>
      current[i] === sortIndices[i]
        ? null
        : updateEntity(
            bm.id,
            { sortIndex: sortIndices[i] },
            { listing: baseMapsListing }
          )
    )
  );

  return sortIndices;
}
