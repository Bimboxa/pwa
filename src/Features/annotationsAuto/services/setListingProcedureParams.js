import db from "App/db/db";

/**
 * Merges `patch` into `listing.procedureParams[procedureKey]` — the values of
 * the parameters a listing-level procedure declares in the registry
 * (`listingParams`, e.g. the revolution axis the château d'eau surfaces are
 * drawn around). Stored on the listing row so the « Dessin auto » band keeps
 * the choice across sessions and base maps.
 */
export default async function setListingProcedureParams(
  listingId,
  procedureKey,
  patch
) {
  if (!listingId || !procedureKey) return false;
  const listing = await db.listings.get(listingId);
  if (!listing || listing.deletedAt) return false;
  const previous = listing.procedureParams ?? {};
  await db.listings.update(listingId, {
    procedureParams: {
      ...previous,
      [procedureKey]: { ...(previous[procedureKey] ?? {}), ...(patch ?? {}) },
    },
  });
  return true;
}
