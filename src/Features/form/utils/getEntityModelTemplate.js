export default function getEntityModelTemplate(entityModel, options) {
  // options

  const zonesTree = options?.zonesTree;
  const entitiesByRelationKey = options?.entitiesByRelationKey ?? {};
  const nomenclaturesByKey = options?.nomenclaturesByKey ?? {};

  // main

  let fields = entityModel?.fieldsObject
    ? Object.values(entityModel.fieldsObject)
    : [];

  fields = fields.map((field) => {
    if (field.type === "zones") {
      return {...field, zonesTree};
    } else if (field.type === "entity") {
      return {
        ...field,
        entities: entitiesByRelationKey
          ? entitiesByRelationKey[field.relationKey]
          : [],
      };
    } else if (field.type === "category") {
      return {
        ...field,
        nomenclature: nomenclaturesByKey[field.nomenclatureKey],
      };
    } else {
      return field;
    }
  });

  return {
    fields,
  };
}
