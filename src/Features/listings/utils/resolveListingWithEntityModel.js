export default function resolveListingWithEntityModel({
  listing,
  entityModelsObject,
}) {
  if (!entityModelsObject) return listing;

  return {...listing, entityModel: entityModelsObject[listing.entityModelKey]};
}
