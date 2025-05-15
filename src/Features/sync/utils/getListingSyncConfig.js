export default function getListingSyncConfig({syncConfig, listingId}) {
  // entities
  const entitiesComputedContext = {entitiesListingsIds: {value: [listingId]}};
  const entities = {
    ...syncConfig?.entities,
    computedContext: entitiesComputedContext,
  };

  // images
  const imagesComputedContext = {listingsIds: {value: [listingId]}};
  const images = {
    ...syncConfig.images,
    computedContext: imagesComputedContext,
  };

  // return

  return {
    ...syncConfig,
    entities,
    images,
  };
}
