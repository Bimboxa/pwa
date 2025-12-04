export default function getModulesAndListingsForLeftPanel({
  listings,
  entityModelTypes,
}) {
  const itemsMap = {};
  const types = entityModelTypes?.map(
    (entityModelType) => entityModelType.type
  );

  // step 1 - updateItemsMap

  listings?.forEach((listing) => {
    const entityModelType = listing.entityModel?.type;
    if (types?.includes(entityModelType)) {
      if (itemsMap[entityModelType]) {
        itemsMap[entityModelType].listings.push(listing);
      } else {
        itemsMap[entityModelType] = {
          listings: [listing],
        };
      }
    }
  });

  // step 2 - return items

  const items = [];
  entityModelTypes?.forEach((entityModelType) => {

    // edge case
    if (entityModelType.type === "BLUEPRINT") return;

    const listings = itemsMap[entityModelType.type]?.listings ?? [];
    if (listings.length > 0 || entityModelType.type === "LOCATED_ENTITY") {
      items.push({ type: "ENTITY_MODEL_TYPE", entityModelType });
      listings.forEach((listing) => {
        items.push({
          type: "LISTING",
          listing,
          showHideButton: entityModelType.type === "LOCATED_ENTITY",
        });
      });
      // add item create located_entity listing
      if (entityModelType.type === "LOCATED_ENTITY") {
        items.push({
          type: "CREATE_LOCATED_LISTING",
        });
      }
    }
  });

  return items;
}
