// Template libraries of a located business-objects listing: the annotation
// listings of the same scope (listing.locationTemplateListingIds, « Bibliothèques »
// in the listing properties) whose templates locate the objects too, next to
// the listing's own location templates. Read-time filter = the single cleanup
// of dangling ids (deleted / unlinked / other-scope listings): nothing is
// rewritten when a library listing disappears.
//
// listingsById: the Redux Dexie mirror (s.listings.listingsById).
export default function getLocationTemplateListingIds(listing, listingsById) {
  const ids = listing?.locationTemplateListingIds;
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const seen = new Set();
  return ids.filter((id) => {
    if (!id || id === listing.id || seen.has(id)) return false;
    const library = listingsById?.[id];
    if (!library || library.deletedAt) return false;
    if (library.scopeId !== listing.scopeId) return false;
    seen.add(id);
    return true;
  });
}

// Does drawing `template` locate the objects of `listing`? Its own templates
// (template.listingId = the business-objects listing) and the templates of
// its libraries.
export function isLocationTemplateForListing(template, listing, listingsById) {
  if (!template?.listingId || !listing?.id) return false;
  if (template.listingId === listing.id) return true;
  return getLocationTemplateListingIds(listing, listingsById).includes(
    template.listingId
  );
}
