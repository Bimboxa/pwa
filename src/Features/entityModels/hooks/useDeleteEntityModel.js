import db from "App/db/db";

export default function useDeleteEntityModel() {
  const remove = async (id) => {
    await db.entityModels.delete(id);
  };

  return remove;
}
