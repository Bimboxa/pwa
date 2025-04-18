import db from "App/db/db";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateProject() {
  const updatedAt = new Date().toISOString();

  const update = async (updates) => {
    try {
      const coreUpdates = {...updates, updatedAt};
      delete coreUpdates.id;
      await db.projects.update(updates.id, coreUpdates);
      const project = await db.projects.get(updates.id);
      //
      console.log("[debug] project updated", project);
      //
      updateItemSyncFile({item: project, type: "PROJECT"});
    } catch (e) {
      console.error("[debug] error", e);
    }
  };

  return update;
}
