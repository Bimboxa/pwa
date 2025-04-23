import db from "App/db/db";
import getDateString from "Features/misc/utils/getDateString";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateProject() {
  const updatedAt = getDateString(new Date());

  const update = async (updates, options) => {
    try {
      const coreUpdates = {...updates, updatedAt};
      delete coreUpdates.id;
      await db.projects.update(updates.id, coreUpdates);
      const project = await db.projects.get(updates.id);
      //
      console.log("[debug] project updated", project);
      //
      if (options?.updateSyncFile) {
        updateItemSyncFile({item: project, type: "PROJECT"});
      }
    } catch (e) {
      console.error("[debug] error", e);
    }
  };

  return update;
}
