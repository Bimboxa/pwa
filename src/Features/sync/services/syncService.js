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
import computeSyncTasksFromSyncFiles from "./computeSyncTasksFromSyncFiles";

export default async function syncService({
  remoteProvider,
  context,
  syncConfig,
  syncFiles,
  dispatch,
  debug,
}) {
  try {
    // step 1 - prepare sync tasks

    dispatch(setPreparingSyncTasks(true));

    let tasks;
    if (syncFiles) {
      tasks = await computeSyncTasksFromSyncFiles({context, syncFiles});
    } else {
      tasks = await prepareSyncTasks({remoteProvider, context, syncConfig});
    }
    dispatch(setPreparingSyncTasks(false));
    dispatch(setSyncTasks(tasks));
    console.log("tasks v2", tasks);

    if (debug) return;

    // step 2 - execute sync tasks
    console.log("tasks_2", tasks, syncFiles);
    for (const task of tasks) {
      dispatch(updateSyncTaskStatus({id: task.id, status: "SYNCING"}));

      try {
        // ____ UP TO DATE ____

        if (task.action === "UP_TO_DATE") {
          const updatedAt = task.updatedAtRemote;
          await updateSyncedAt(task, updatedAt);
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

          // we update syncFile based one the updatedAtClient (=file.lastModified); !NOOO => base on task.updatedAtLocal
          if (file) {
            //const updatedAt = getDateString(file.lastModified);
            const updatedAt = task.updatedAtLocal;
            await updateSyncedAt(task, updatedAt);
          }
        }

        dispatch(updateSyncTaskStatus({id: task.id, status: "DONE"}));
      } catch (e) {
        console.error("[syncService] Error in task:", task, e);
        dispatch(updateSyncTaskStatus({id: task.id, status: "ERROR"}));
      }
    }

    dispatch(setSyncTasks([]));
  } catch (e) {
    console.log("error", e);
  }
}

async function updateSyncedAt(task, updatedAt) {
  const syncAt = getDateString(Date.now());
  try {
    const path = task.filePath;
    await updateSyncFile({path, updatedAt, syncAt});
  } catch (e) {
    console.error("[updateSyncedAt] Error updating syncFiles:", e);
  }
}
