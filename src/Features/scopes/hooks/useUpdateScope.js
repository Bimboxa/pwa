import db from "App/db/db";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateScope() {
  const updatedAt = Date.now();

  const update = async (updates) => {
    const coreUpdates = {...updates, updatedAt};
    delete coreUpdates.id;
    await db.scopes.update(updates.id, coreUpdates);
    //
    const scope = await db.scopes.get(updates.id);
    updateItemSyncFile({item: scope, type: "SCOPE"});
  };

  return update;
}
