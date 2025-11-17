/*
 * resolve entity props (label, subLabel, relatedObject,..) from entityModel & db data
 */

import getEntityComputedFieldsAsync from "./getEntityComputedFieldsAsync";

export default async function resolveEntitiesPropsAsync({ entities, listing }) {
  // edge case

  if (!entities) return null;

  // helpers

  const entityModel = listing?.entityModel;
  console.log("debug_1311_entityModel", entityModel);

  // main

  const resolvedEntities = await Promise.all(
    entities.map(async (entity) => {
      // computedFields

      // const computedFields = await getEntityComputedFieldsAsync(
      //   _computedFields,
      //   entity,
      //   entities
      // );

      const computedFields = await getEntityComputedFieldsAsync(entity);

      entity = { ...entity, ...computedFields };

      // labels
      let label, subLabel;
      if (entityModel) {
        label = entity[entityModel.labelKey];
        subLabel = entity[entityModel.subLabelKey];
      }
      // return
      return { ...entity, label, subLabel };
    })
  );

  return resolvedEntities;
}
