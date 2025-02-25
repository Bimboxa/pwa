export default function getEntityTypeFromListType(listType) {
  let entityType = "DEFAULT";
  if (listType === "SHAPES") {
    entityType = "SHAPE";
  }
  return entityType;
}
