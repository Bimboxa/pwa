import db from "App/db/db";

export default function useUpdateEntityModel() {
  const update = async (entityModel) => {
    await db.entityModels.put(entityModel);
    return entityModel;
  };

  return update;
}
