import db from "App/db/db";

import getEntityWithImagesAsync from "./getEntityWithImagesAsync";

export default async function getAnnotationEntityAsync(annotation, appConfig) {
  // options

  // data

  const listing = await db.listings.get(annotation.listingId);
  const entityModel = appConfig?.entityModelsObject?.[listing?.entityModelKey];
  const entityModelType = entityModel?.type;
  const table = listing?.table;

  console.log("debug_1311_listing", listing, entityModel);

  if (!table) return null;

  const entity = await db[table].get(annotation.entityId);
  const { entityWithImages, hasImages } = await getEntityWithImagesAsync(
    entity
  );

  return { ...entityWithImages, entityModelType };
}
