import db from "App/db/db";
import updateSyncFileProject from "../services/updateSyncFileProject";

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
      updateSyncFileProject({project});
    } catch (e) {
      console.error("[debug] error", e);
    }
  };

  return update;
}
