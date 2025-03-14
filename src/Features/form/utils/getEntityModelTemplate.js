export default function getEntityModelTemplate(entityModel) {
  const fields = entityModel?.fieldsObject
    ? Object.values(entityModel.fieldsObject)
    : [];

  return {
    fields,
  };
}
