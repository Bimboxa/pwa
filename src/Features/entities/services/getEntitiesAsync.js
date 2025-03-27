import db from "App/db/db";

export default async function getEntitiesAsync(options) {
  // options

  const listingsIds = options?.listingsIds;

  // helpers

  let entities;

  if (listingsIds) {
    entities = await db.entities.where("listingId").anyOf(listingsIds);
  }

  return entities;
}
