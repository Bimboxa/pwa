// Listings LINKED into a scope from another scope ("Depuis un autre Krto",
// db.relsScopeListing) that are actually displayable: the linked listing must
// be loaded locally (present in listingsById, hence not deleted) and its
// source scope too (present in scopesById). A host Krto zip carries the rel
// rows only, so on a device without the source Krto the link is silently
// invisible instead of dangling. Pure — no alias import, replayable in node.
//
// linkedSourceByScopeId: {[hostScopeId]: {[listingId]: sourceScopeId}}
//   (listingsSlice.linkedListingSourceByScopeId)
// => Set<listingId>
export default function getLinkedListingIdsForScope({
  linkedSourceByScopeId,
  scopeId,
  listingsById,
  scopesById,
} = {}) {
  const ids = new Set();
  if (!scopeId) return ids;
  const linked = linkedSourceByScopeId?.[scopeId];
  if (!linked) return ids;
  for (const [listingId, sourceScopeId] of Object.entries(linked)) {
    const listing = listingsById?.[listingId];
    if (!listing || listing.deletedAt) continue;
    // paternity check: the listing must still belong to the source scope
    // (a listing re-assigned to the host — or to a third scope — is no link)
    if (listing.scopeId === scopeId) continue;
    const effectiveSourceScopeId = sourceScopeId ?? listing.scopeId;
    if (!effectiveSourceScopeId || !scopesById?.[effectiveSourceScopeId])
      continue;
    if (listing.scopeId && listing.scopeId !== effectiveSourceScopeId) continue;
    ids.add(listingId);
  }
  return ids;
}
