import db from "App/db/db";

import updateSyncFile from "./updateSyncFile";

import {
  setPreparingSyncTasks,
  setSyncTasks,
  updateSyncTaskStatus,
} from "../syncSlice";

import getDateString from "Features/misc/utils/getDateString";

import prepareSyncTasks from "./prepareSyncTasks";
import syncTaskRemoteToLocal from "./syncTaskRemoteToLocal";
import syncTaskLocalToRemote from "./syncTaskLocalToRemote";

export default async function syncService({
  remoteProvider,
  context,
  syncConfig,
  dispatch,
}) {
  // step 1 - prepare sync tasks

  dispatch(setPreparingSyncTasks(true));
  const tasks = await prepareSyncTasks({
    remoteProvider,
    context,
    syncConfig,
  });
  dispatch(setPreparingSyncTasks(false));
  dispatch(setSyncTasks(tasks));
  console.log("tasks v2", tasks);

  // step 2 - execute sync tasks

  for (const task of tasks) {
    dispatch(updateSyncTaskStatus({id: task.id, status: "SYNCING"}));

    try {
      // ____ UP TO DATE ____

      if (task.action === "UP_TO_DATE") {
        await db.syncFiles.update(filePath, {syncAt: updatedAtRemote});
      }

      // ---- PULL ----

      if (task.action === "PULL") {
        await syncTaskRemoteToLocal({task, remoteProvider});

        // we update syncFile based one the updatedAtRemote;
        const updatedAt = task.updatedAtRemote;
        await updateSyncedAt(task, updatedAt);

        // ---- PUSH ----
      } else if (task.action === "PUSH") {
        const file = await syncTaskLocalToRemote({
          task,
          remoteProvider,
        });

        // we update syncFile based one the updatedAtClient (=file.lastModified);
        if (file) {
          const updatedAt = getDateString(file.lastModified);
          await updateSyncedAt(task, updatedAt);
        }
      }

      dispatch(updateSyncTaskStatus({id: task.id, status: "DONE"}));
    } catch (e) {
      console.error("[syncService] Error in task:", task, e);
      dispatch(updateSyncTaskStatus({id: task.id, status: "ERROR"}));
    }
  }
}

async function updateSyncedAt(task, updatedAt) {
  try {
    const path = task.filePath;
    await updateSyncFile({path, updatedAt, syncAt: updatedAt});
  } catch (e) {
    console.error("[updateSyncedAt] Error updating syncFiles:", e);
  }
}
