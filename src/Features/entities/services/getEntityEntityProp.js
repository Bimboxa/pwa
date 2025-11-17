import db from "App/db/db";

import getEntityComputedFieldsAsync from "./getEntityComputedFieldsAsync";

export default async function getEntityEntityProp(entity, entityProp) {
  console.log("debug_1311_entityEntity", entity, entityProp);
  // edge

  if (!entity || !entityProp) return null;

  // main

  const [field, prop] = entityProp.split(".");

  const { id, listingId } = entity[field] ?? {};

  const listing = await db.listings.get(listingId);

  let object;
  if (listing?.table && id) {
    object = await db[listing?.table].get(id);
    const fields = await getEntityComputedFieldsAsync(object);
    object = { ...object, ...fields };
  }

  console.log("debug_1311_entity2", object);

  return object ? object[prop] : null;
}
