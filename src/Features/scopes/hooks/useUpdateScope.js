import db from "App/db/db";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

import useCreateRemoteScope from "Features/sync/hooks/useCreateRemoteScope";

export default function useUpdateScope() {
  const createRemoteScope = useCreateRemoteScope();

  const update = async (updates, options) => {
    console.log("debug_2504 updateScope", updates, options);
    const coreUpdates = {...updates};
    delete coreUpdates.id;
    await db.scopes.update(updates.id, coreUpdates);
    //
    const scope = await db.scopes.get(updates.id);
    //
    if (options?.updateSyncFile) {
      await updateItemSyncFile({item: scope, type: "SCOPE"});
    }

    //
    if (options?.forceLocalToRemote) {
      await createRemoteScope(scope);
    }
    return scope;
  };

  return update;
}
