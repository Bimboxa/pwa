import db from "App/db/db";

// Removes the link of a listing into a host scope (soft delete of the live
// db.relsScopeListing rows through the middleware). The listing itself and
// its content are untouched — they belong to the source scope. Returns the
// number of removed rels.
export default async function unlinkListingFromScopeService({
  hostScopeId,
  listingId,
}) {
  if (!hostScopeId || !listingId) return 0;

  return db.transaction("rw", db.relsScopeListing, async () => {
    const rels = (
      await db.relsScopeListing.where("scopeId").equals(hostScopeId).toArray()
    ).filter((r) => !r.deletedAt && r.listingId === listingId);
    if (rels.length === 0) return 0;
    await db.relsScopeListing.bulkDelete(rels.map((r) => r.id));
    return rels.length;
  });
}
