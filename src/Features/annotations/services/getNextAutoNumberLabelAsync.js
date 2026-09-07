import db from "App/db/db";

import getNextAutoNumberLabel from "../utils/getNextAutoNumberLabel";

// Resolves the listing + the labels of its live annotations. Returns null
// when the listing does not auto-number its annotations.
async function loadListingLabelsAsync(listingId) {
  if (!listingId) return null;
  const listing = await db.listings.get(listingId);
  if (!listing?.autoNumberAnnotations) return null;
  const rows = await db.annotations
    .where("listingId")
    .equals(listingId)
    .toArray();
  const labels = rows.filter((r) => !r.deletedAt).map((r) => r.label);
  return { listing, labels };
}

/**
 * Next auto-numbered label for one annotation of `listingId`, or null when
 * the listing option is off. Must be awaited OUTSIDE a Dexie transaction
 * (it reads db.listings / db.annotations on its own).
 */
export default async function getNextAutoNumberLabelAsync(listingId) {
  const entry = await loadListingLabelsAsync(listingId);
  if (!entry) return null;
  return getNextAutoNumberLabel(entry.listing, entry.labels);
}

/**
 * Batch variant: one allocator per write batch (clone / duplicate). The
 * listing + labels are read once per listing, then every call hands out the
 * next number so the copies of a batch are numbered sequentially.
 */
export function createAutoNumberLabelAllocator() {
  const byListingId = new Map();
  return async (listingId) => {
    if (!listingId) return null;
    if (!byListingId.has(listingId)) {
      byListingId.set(listingId, await loadListingLabelsAsync(listingId));
    }
    const entry = byListingId.get(listingId);
    if (!entry) return null;
    const label = getNextAutoNumberLabel(entry.listing, entry.labels);
    entry.labels.push(label);
    return label;
  };
}
