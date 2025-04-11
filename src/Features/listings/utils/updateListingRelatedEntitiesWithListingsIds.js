export default function updateListingRelatedEntitiesWithListingsIds(
  relatedEntities,
  listingByKey
) {
  // relatedEntities = {key1:{listingsKeys:[],listingsIds:[]},key2:{listingsKeys:[],listingsIds:[]}}

  const updatedRelatedEntities = {};

  for (const [key, value] of Object.entries(relatedEntities)) {
    const {listingsKeys} = value;
    const listingsIds = listingsKeys.map((listingKey) => {
      const listing = listingByKey[listingKey];
      return listing?.id;
    });
    updatedRelatedEntities[key] = {
      ...value,
      listingsIds,
    };
  }
  return updatedRelatedEntities;
}
