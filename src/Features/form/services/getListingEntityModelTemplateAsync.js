import db from "App/db/db";
import resolveEntitiesPropsAsync from "Features/entities/services/resolveEntitiesPropsAsync";
import resolveListingWithEntityModel from "Features/listings/utils/resolveListingWithEntityModel";

export default async function getListingEntityModelTemplateAsync({
  listing,
  entityModelsObject,
}) {
  // edge case

  console.log("listing", listing);
  if (!listing) return null;

  // helpers

  const entityModel = listing?.entityModel;

  // main

  let fields = entityModel?.fieldsObject
    ? Object.values(entityModel.fieldsObject)
    : [];

  fields = await Promise.all(
    fields.map(async (field) => {
      const _field = {};
      await Promise.all(
        Object.entries(field).map(async ([key, value]) => {
          if (value.listingKey) {
            const _relatedListing = listing.relatedListings[value.listingKey];
            console.log("debug_3050 _relatedListing", _relatedListing);
            if (_relatedListing) {
              console.log("debug_3005 _relatedListing", _relatedListing);
              let relatedListing = await db.listings.get(_relatedListing.id);
              relatedListing = resolveListingWithEntityModel({
                listing: relatedListing,
                entityModelsObject,
              });
              if (key === "nomenclature") {
                _field[key] = relatedListing?.metadata?.nomenclature;
              } else if (key === "zonesTree") {
                const zoning = await db[relatedListing.table].get(
                  relatedListing.id
                );
                _field[key] = zoning?.zonesTree;
                _field["zonesListing"] = relatedListing;
              } else if (key === "entities") {
                let entities = await db[relatedListing.table]
                  .where("listingId")
                  .equals(relatedListing.id)
                  .toArray();
                entities = await resolveEntitiesPropsAsync({
                  entities,
                  listing: relatedListing,
                });
                console.log("debug_3050 entities", entities);
                _field[key] = entities;
                _field["entitiesListing"] = relatedListing;
              }
            } else {
              console.error("[error] in relatedListings of listing ", listing);
            }
          } else {
            _field[key] = value;
          }
        })
      );
      return _field;
    })
  );

  return {
    fields,
  };
}
