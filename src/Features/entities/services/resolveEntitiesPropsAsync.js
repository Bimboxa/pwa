/*
 * resolve entity props (label, subLabel, relatedObject,..) from entityModel & db data
 */

export default async function resolveEntitiesPropsAsync({entities, listing}) {
  // edge case

  if (!entities) return null;

  // helpers

  const entityModel = listing?.entityModel;

  // main

  const resolvedEntities = entities.map((entity) => {
    // label
    let label;
    if (entityModel) label = entity[entityModel.labelKey];

    // return
    return {...entity, label};
  });

  return resolvedEntities;
}
