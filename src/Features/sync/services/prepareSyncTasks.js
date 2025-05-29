/*
 * syncTask:
 * PULL & PUSH
 * - direction : PUSH (localToRemote) or PULL (remoteToLocal)
 * - folderPath
 * - filePath
 * - table
 * PULL:
 * - fetchBy : FILE || FOLDER
 * - filterFilesById : {template,in}
 * PUSH:
 * - writeMode : TABLE_ENTRIES_TO_ITEMS || TABLE_ENTRY_TO_DATA
 * - entryId
 * - filterEntries: {key,in,value}
 */

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import resolveSyncFilesLocal from "./resolveSyncFilesLocal";
import resolveSyncFilesRemote from "./resolveSyncFilesRemote";
import intersectItems from "Features/misc/utils/intersectItems";

let taskIdCounter = 0;

export default async function prepareSyncTasks({
  syncConfig,
  context,
  remoteProvider,
}) {
  const allTasks = [];

  for (const [key, config] of Object.entries(syncConfig)) {
    const priority = config.priority ?? Infinity;
    const direction = config.direction;
    const syncFileKey = config.syncFile.key;

    let syncFilesRemote = [];
    if (direction !== "PUSH") {
      syncFilesRemote = await resolveSyncFilesRemote(
        config,
        context,
        remoteProvider
      );
    }

    let syncFilesLocal = [];
    if (direction !== "PULL") {
      syncFilesLocal = await resolveSyncFilesLocal(config, context);
    }

    console.log(
      "[prepareSyncTasks] syncFiles",
      direction,
      syncFilesLocal,
      syncFilesRemote
    );
    const [syncFiles_PULL, syncFiles_PUSH, syncFiles_BOTH] = intersectItems(
      syncFilesRemote,
      syncFilesLocal,
      "filePath"
    );

    // PULL
    syncFiles_PULL?.forEach((syncFile) => {
      if (direction === "PUSH") return;
      allTasks.push({
        ...syncFile,
        id: `task-${taskIdCounter++}`,
        action: "PULL",
        priority,
        syncFileKey,
      });
    });

    // PUSH
    syncFiles_PUSH?.forEach((syncFile) => {
      if (direction === "PULL") return;
      allTasks.push({
        ...syncFile,
        id: `task-${taskIdCounter++}`,
        action: "PUSH",
        priority,
        syncFileKey,
      });
    });

    // BOTH
    syncFiles_BOTH?.forEach((syncFile) => {
      const {updatedAtRemote, updatedAtLocal} = syncFile;

      const shouldPush = updatedAtLocal > updatedAtRemote;
      const shouldPull = updatedAtRemote > updatedAtLocal;
      const upToDate = updatedAtRemote === updatedAtLocal;

      let _action = "UP_TO_DATE";
      if (shouldPush) _action = "PUSH";
      if (shouldPull) _action = "PULL";

      const action = direction !== "BOTH" ? direction : _action;

      allTasks.push({
        ...syncFile,
        id: `task-${taskIdCounter++}`,
        action,
        priority,
        syncFileKey,
      });
    });
  }

  // Tri par priorité
  allTasks.sort((a, b) => a.priority - b.priority);
  return allTasks;
}
