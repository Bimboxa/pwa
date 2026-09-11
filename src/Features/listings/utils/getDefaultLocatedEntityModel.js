// appConfig.entityModelsObject → the LOCATED_ENTITY model new drawing lists
// (annotations) are created with.
//
// The `isDefault` flag is optional and only some org configs carry it (edx);
// relying on it alone left lei/default listings without any entityModelKey,
// so they fell into the "Autres" bucket of the scope panel and were filtered
// out of the drawing panel. Precedence: isDefault flag > "annotation" key
// (present in every org config) > first LOCATED_ENTITY model.
export default function getDefaultLocatedEntityModel(appConfig) {
  const models = Object.values(appConfig?.entityModelsObject ?? {});
  const located = models.filter((em) => em?.type === "LOCATED_ENTITY");
  return (
    located.find((em) => em.isDefault) ??
    located.find((em) => em.key === "annotation") ??
    located[0] ??
    null
  );
}
