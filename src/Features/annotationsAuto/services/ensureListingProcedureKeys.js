import db from "App/db/db";

/**
 * Adds procedure keys to `listing.procedureKeys` (listing-level « Dessin
 * auto » band) when they are missing — a no-op otherwise. Used when a système
 * is materialized in a listing: the procedures chained to the système's
 * procedure (registry `chainedProcedureKeys`, e.g. the château d'eau surfaces)
 * are launched from the listing, so the listing must link them.
 */
export default async function ensureListingProcedureKeys(listingId, keys) {
  const wanted = (keys ?? []).filter(Boolean);
  if (!listingId || wanted.length === 0) return false;
  const listing = await db.listings.get(listingId);
  if (!listing || listing.deletedAt) return false;
  const current = listing.procedureKeys ?? [];
  const missing = wanted.filter((key) => !current.includes(key));
  if (missing.length === 0) return false;
  await db.listings.update(listingId, {
    procedureKeys: [...current, ...missing],
  });
  return true;
}
