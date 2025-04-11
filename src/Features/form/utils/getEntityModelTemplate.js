export default function getEntityModelTemplate(entityModel, options) {
  // options

  const zonesTree = options?.zonesTree;
  const entitiesByRelationKey = options?.entitiesByRelationKey;

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
    } else {
      return field;
    }
  });

  return {
    fields,
  };
}
