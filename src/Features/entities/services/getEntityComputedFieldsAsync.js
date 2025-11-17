import getEntityEntityProp from "./getEntityEntityProp";

import db from "App/db/db";

export default async function getEntityComputedFieldsAsync(entity) {
  // computedFields & entities

  const listing = await db.listings.get(entity?.listingId);

  const computedFields = listing?.entityModel?.computedFields;

  console.log("computedFields", computedFields, listing);

  if (!computedFields || typeof computedFields !== "object") {
    return {};
  }

  const entities = listing?.table
    ? await db[listing?.table].where("listingId").equals(listing?.id).toArray()
    : null;

  const entries = await Promise.all(
    Object.entries(computedFields).map(async ([key, config]) => {
      try {
        console.log("debug_1311_entries", config);
        if (config?.entityProp) {
          const value = await getEntityEntityProp(entity, config?.entityProp);
          return [key, value];
        } else if (config?.scriptKey) {
          const scriptKey = config?.scriptKey;
          const module = await import(`../scripts/${scriptKey}.js`);
          const compute = module?.default;

          if (typeof compute !== "function") {
            console.warn(
              `[getEntityComputedFieldsAsync] Script '${scriptKey}' does not export a default function.`
            );
            return [key, null];
          }

          const value = await compute(entity, entities);
          return [key, value];
        }
      } catch (error) {
        console.error("error_1311", error);
        return [key, null];
      }
    })
  );

  // return props as {}
  console.log("debug_1311_entries", entries);
  return entries?.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}
