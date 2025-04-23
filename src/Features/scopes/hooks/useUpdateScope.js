import db from "App/db/db";
import getDateString from "Features/misc/utils/getDateString";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateScope() {
  const updatedAt = getDateString(Date.now());

  const update = async (updates, options) => {
    const coreUpdates = {...updates, updatedAt};
    delete coreUpdates.id;
    await db.scopes.update(updates.id, coreUpdates);
    //
    const scope = await db.scopes.get(updates.id);
    //
    if (options?.updateSyncFile) {
      await updateItemSyncFile({item: scope, type: "SCOPE"});
    }
    return scope;
  };

  return update;
}
