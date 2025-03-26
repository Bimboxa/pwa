export default function getEntityModelTemplate(entityModel, options) {
  const zonesTree = options?.zonesTree;

  let fields = entityModel?.fieldsObject
    ? Object.values(entityModel.fieldsObject)
    : [];

  fields = fields.map((field) => {
    if (field.key === "zones") {
      return {...field, zonesTree};
    } else {
      return field;
    }
  });

  return {
    fields,
  };
}
