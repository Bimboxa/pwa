// syncService.js

import db from "App/db/db";

import resolveSyncTasks from "./resolveSyncTasks";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import resolveTemplate from "../utils/resolveTemplate";

import {setSyncTasks, updateSyncTaskStatus} from "../syncSlice";

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
 * @param {Object} options.syncFilesByPath - Redux store syncFiles (filePath -> { updatedAt })
 */

export default async function syncService({
  remoteProvider,
  context,
  syncConfig,
  syncFilesByPath,
  dispatch,
}) {
  console.log("[debug] syncService", context);
  //
  for (const [key, config] of Object.entries(syncConfig)) {
    const tasks = await resolveSyncTasks(config, context, remoteProvider);
    dispatch(setSyncTasks(tasks));

    for (const task of tasks) {
      // state
      dispatch(updateSyncTaskStatus({filePath: task.filePath, status: "WIP"}));

      try {
        //
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
          await remoteToLocal({task, config, remoteProvider, context});
          await updateSyncedAt(task);
        } else if (shouldPush) {
          await localToRemote({task, config, remoteProvider, context});
          await updateSyncedAt(task);
        }
        dispatch(
          updateSyncTaskStatus({filePath: task.filePath, status: "DONE"})
        );
      } catch (e) {
        console.error("[syncService] Error in task:", task, e);
        dispatch(
          updateSyncTaskStatus({filePath: task.filePath, status: "ERROR"})
        );
      }
    }
  }
}

async function remoteToLocal({task, config, remoteProvider, context}) {
  if (config.remoteToLocal?.mode === "FILES_REMOTE_TO_LOCAL") {
    const folder = resolveTemplate(config.remoteFolder, {
      ...context,
      remoteProvider,
    });
    const metas = await remoteProvider.fetchFilesMetadataFromFolder(folder);
    const localFiles = await db[task.table].toArray();
    const localPaths = new Set(localFiles.map((f) => f.name));

    for (const meta of metas) {
      if (!localPaths.has(meta.name)) {
        const blob = await remoteProvider.downloadFile(meta.path);
        const file = {
          id: meta.name,
          name: meta.name,
          size: meta.size,
          type: meta.mimeType,
          lastModifiedAt: meta.lastModifiedAt,
          file: blob,
        };
        await db[task.table].put(file);
      }
    }
    return;
  }

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

async function localToRemote({task, config, remoteProvider, context}) {
  let payload;

  switch (config.localToRemote?.mode) {
    case "TABLE_ENTRY_TO_DATA": {
      const entry = await db[task.table].get(task.localFilter.id);
      payload = {data: entry};
      const file = jsonObjectToFile(payload);
      await remoteProvider.postFile(task.filePath, file);
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
        const all = await db[task.table].toArray();
        const filtered = all.filter((item) =>
          keys.every((k) => item[k] === task.localFilter[k])
        );
        payload = {items: filtered};
      }
      const file = jsonObjectToFile(payload);
      await remoteProvider.postFile(task.filePath, file);
      break;
    }
    case "FILES_LOCAL_TO_REMOTE": {
      const filters = config.localToRemote.filterEntries || [];
      const [first, ...rest] = filters;
      let entries = await db[task.table]
        .where(first.key)
        .anyOf(first.in || [])
        .toArray();
      if (rest.length > 0) {
        entries = entries.filter((entry) =>
          rest.every((f) =>
            f.in ? f.in.includes(entry[f.key]) : entry[f.key] === f.value
          )
        );
      }

      for (const entry of entries) {
        const filePath = resolveTemplate(
          config.remoteFolder + "/" + config.remoteFile,
          {
            ...context,
            file: entry,
            remoteProvider,
          }
        );
        await remoteProvider.postFile(filePath, entry.file);
        await updateSyncedAt({filePath});
      }
      break;
    }
    default:
      console.warn(
        "[localToRemote] Unsupported mode:",
        config.localToRemote?.mode
      );
  }
}

async function updateSyncedAt(task) {
  try {
    const path = task.filePath;
    const updatedAt = new Date().toISOString();
    const existing = await db.syncFiles.get(path);

    if (existing) {
      await db.syncFiles.update(path, {updatedAt});
    } else {
      await db.syncFiles.put({path, updatedAt});
    }
  } catch (e) {
    console.error("[updateSyncedAt] Error updating syncFiles:", e);
  }
}
