export default function getListingRelatedEntitiesListingsIds(listing) {
  // edge case

  if (!listing?.relatedEntities) return [];

  const relatedEntities = listing?.relatedEntities;

  const listingsIds = Object.values(relatedEntities).reduce((acc, cur) => {
    const listingsIds = cur?.listingsIds ?? [];
    return acc.concat(listingsIds);
  }, []);

  return listingsIds;
}
