// Total of the annotations of a scope, as the SCOPE module's "all listings"
// mode displays them: the annotation listings (LOCATED_ENTITY) minus the
// base-map annotation listings (isForBaseMaps), which the recap editor leaves
// out (excludeIsForBaseMapsListings). itemsCountById comes from
// useListingItemsCountById.
export default function getAnnotationListingsCount(listings, itemsCountById) {
  let count = 0;
  for (const listing of listings ?? []) {
    if (listing?.entityModel?.type !== "LOCATED_ENTITY") continue;
    if (listing.isForBaseMaps) continue;
    count += itemsCountById?.[listing.id] ?? 0;
  }
  return count;
}
