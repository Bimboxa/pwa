// syncService.js

import db from "App/db/db";

import resolveSyncTasks from "./resolveSyncTasks";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import updateSyncFile from "./updateSyncFile";

/**
 * @typedef {Object} SyncTask
 * @property {string} filePath
 * @property {string} table
 * @property {"PULL" | "PUSH" | "BOTH"} direction
 * @property {Object} localFilter
 * @property {string} [updatedAtRemote]
 * @property {string} [updatedAtLocal]
 */

/**
 * Main entry point to sync all files
 * @param {Object} options
 * @param {Object} options.remoteProvider
 * @param {Object} options.context - project, listing, etc.
 * @param {Object} options.syncConfig - syncConfig object
 * @param {Object} options.localSyncFiles - Redux store syncFiles (filePath -> { updatedAt })
 */

export default async function syncService({
  remoteProvider,
  context,
  syncConfig,
  syncFilesByPath,
}) {
  for (const [key, config] of Object.entries(syncConfig)) {
    const tasks = await resolveSyncTasks(config, context, remoteProvider);

    for (const task of tasks) {
      const {direction, updatedAtRemote, filePath, table} = task;
      const updatedAtLocal = syncFilesByPath?.[filePath]?.updatedAt;

      const shouldPull =
        (direction === "PULL" || direction === "BOTH") &&
        updatedAtRemote &&
        (!updatedAtLocal || updatedAtRemote > updatedAtLocal);

      const shouldPush =
        (direction === "PUSH" || direction === "BOTH") &&
        updatedAtLocal &&
        (!updatedAtRemote || updatedAtLocal > updatedAtRemote);

      if (shouldPull) {
        await remoteToLocal({task, config, remoteProvider});
        await updateSyncedAt(task);
      } else if (shouldPush) {
        await localToRemote({task, config, remoteProvider});
        await updateSyncedAt(task);
      }
    }
  }
}

async function remoteToLocal({task, config, remoteProvider}) {
  const file = await remoteProvider.downloadFile(task.filePath);
  const fileContent = await jsonFileToObjectAsync(file);

  switch (config.remoteToLocal?.mode) {
    case "DATA_TO_TABLE_ENTRY":
      if (fileContent?.data) {
        await db[task.table].put(fileContent.data);
      }
      break;

    case "ITEMS_TO_TABLE_ENTRIES":
      if (Array.isArray(fileContent?.items)) {
        await db[task.table].bulkPut(fileContent.items);
      }
      break;

    default:
      console.warn(
        "[remoteToLocal] Unsupported mode:",
        config.remoteToLocal?.mode
      );
  }
}

async function localToRemote({task, config, remoteProvider}) {
  let payload;

  switch (config.localToRemote?.mode) {
    case "TABLE_ENTRY_TO_DATA": {
      const entry = await db[task.table].get(task.localFilter.id);
      payload = {data: entry};
      break;
    }
    case "TABLE_ENTRIES_TO_ITEMS": {
      const keys = Object.keys(task.localFilter);
      if (keys.length === 1) {
        const [key] = keys;
        const entries = await db[task.table]
          .where(key)
          .equals(task.localFilter[key])
          .toArray();
        payload = {items: entries};
      } else {
        console.warn("Dexie: compound query not supported without index");
        payload = {items: []};
      }
      break;
    }
    default:
      console.warn(
        "[localToRemote] Unsupported mode:",
        config.localToRemote?.mode
      );
      return;
  }

  const file = jsonObjectToFile(payload);
  await remoteProvider.postFile(task.filePath, file);
}

async function updateSyncedAt(task) {
  const path = task.filePath;
  const syncFileType = task.table;
  await updateSyncFile(path);
}
