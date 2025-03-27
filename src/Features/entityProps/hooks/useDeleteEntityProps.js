import db from "App/db/db";

export default function useDeleteEntityProps() {
  const deleteEntityProps = async (id) => {
    try {
      await db.entitiesProps.delete(id);
    } catch (err) {
      console.error("Error deleting entity props", err);
    }
  };
  return deleteEntityProps;
}
