import db from "App/db/db";

import resolveSyncTasks from "./resolveSyncTasks";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import resolveTemplate from "../utils/resolveTemplate";
import updateSyncFile from "./updateSyncFile";

import {
  setPreparingSyncTasks,
  setSyncTasks,
  updateSyncTaskStatus,
} from "../syncSlice";
import getDateString from "Features/misc/utils/getDateString";

let taskIdCounter = 0;

export async function prepareSyncTasks({
  remoteProvider,
  context,
  syncConfig,
  syncFilesByPath,
  dispatch,
}) {
  const allTasks = [];
  dispatch(setPreparingSyncTasks(true));

  for (const [key, config] of Object.entries(syncConfig)) {
    const rawTasks = await resolveSyncTasks(config, context, remoteProvider);

    const priority = config.priority ?? Infinity;

    rawTasks.forEach(async (task) => {
      const filePath = task.filePath;
      const updatedAtRemote = task.updatedAtRemote;
      const updatedAtLocal = syncFilesByPath?.[filePath]?.updatedAt;

      console.log(
        "rawTask",
        config.syncFileType,
        task.fileName,
        updatedAtRemote,
        updatedAtLocal
      );

      // update syncFile with syncAt if updatedAtRemote === updatedAtLocal to reset syncFilesToPush
      if (updatedAtRemote === updatedAtLocal) {
        await updateSyncedAt(task, updatedAtRemote);
        return;
      }

      // Décider de l'action en fonction des dates
      if (
        (task.direction === "PULL" || task.direction === "BOTH") &&
        updatedAtRemote &&
        (!updatedAtLocal || updatedAtRemote > updatedAtLocal)
      ) {
        allTasks.push({
          ...task,
          id: `task-${taskIdCounter++}`,
          action: "PULL",
          updatedAtLocal,
          priority,
        });
      }

      if (
        (task.direction === "PUSH" || task.direction === "BOTH") &&
        updatedAtLocal &&
        (!updatedAtRemote || updatedAtLocal > updatedAtRemote)
      ) {
        allTasks.push({
          ...task,
          id: `task-${taskIdCounter++}`,
          action: "PUSH",
          updatedAtLocal,
          priority,
        });
      }
    });
  }

  dispatch(setPreparingSyncTasks(false));

  // Tri par priorité
  allTasks.sort((a, b) => a.priority - b.priority);
  return allTasks;
}

export default async function syncService({
  remoteProvider,
  context,
  syncConfig,
  syncFilesByPath,
  dispatch,
}) {
  const tasks = await prepareSyncTasks({
    remoteProvider,
    context,
    syncConfig,
    syncFilesByPath,
    dispatch,
  });

  dispatch(setSyncTasks(tasks));
  console.log("tasks v2", tasks);

  for (const task of tasks) {
    dispatch(updateSyncTaskStatus({id: task.id, status: "SYNCING"}));

    try {
      const config = Object.values(syncConfig).find(
        (cfg) => cfg.localTable === task.table
      );

      // ---- PULL ----

      if (task.action === "PULL") {
        await remoteToLocal({task, config, remoteProvider, context});

        // we update syncFile based one the updatedAtRemote;
        const updatedAt = task.updatedAtRemote;
        await updateSyncedAt(task, updatedAt);

        // ---- PUSH ----
      } else if (task.action === "PUSH") {
        const file = await localToRemote({
          task,
          config,
          remoteProvider,
          context,
        });

        // we update syncFile based one the updatedAtClient (=file.lastModified);
        const updatedAt = getDateString(file.lastModified);
        await updateSyncedAt(task, updatedAt);
      }

      dispatch(updateSyncTaskStatus({id: task.id, status: "DONE"}));
    } catch (e) {
      console.error("[syncService] Error in task:", task, e);
      dispatch(updateSyncTaskStatus({id: task.id, status: "ERROR"}));
    }
  }
}

async function remoteToLocal({task, config, remoteProvider, context}) {
  if (config.remoteToLocal?.mode === "FILES_REMOTE_TO_LOCAL") {
    const folder = resolveTemplate(config.remoteToLocal.remoteFolder, {
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

    case "ITEMS_TO_TABLE_ENTRIES": {
      let items = Array.isArray(fileContent?.items) ? fileContent.items : [];
      const filterEntries = config.localToRemote?.filterEntries || [];

      if (filterEntries.length > 0) {
        items = items.filter((item) => {
          return filterEntries.every((rule) => {
            if (rule.in && Array.isArray(context[rule.in])) {
              const ids = context[rule.in].map((o) => o.id);
              return ids.includes(item[rule.key]);
            }
            if (rule.value) {
              const expected = rule.value
                .split(".")
                .reduce((acc, k) => acc?.[k], context);
              return item[rule.key] === expected;
            }
            return true;
          });
        });
      }

      if (items.length > 0) await db[task.table].bulkPut(items);
      break;
    }

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
      const id = task.localFilter.id;
      if (!id) {
        throw new Error(
          `[localToRemote] Missing id in localFilter for table ${task.table}`
        );
      }
      const entry = await db[task.table].get(id);
      payload = {data: entry};
      const file = jsonObjectToFile(payload, task.fileName);
      await remoteProvider.postFile(task.filePath, file);
      return file;
    }
    case "TABLE_ENTRIES_TO_ITEMS": {
      const filterEntries = config.localToRemote?.filterEntries || [];
      let entries = await db[task.table].toArray();

      if (filterEntries.length > 0) {
        entries = entries.filter((item) => {
          return filterEntries.every((rule) => {
            if (rule.in && Array.isArray(context[rule.in])) {
              const ids = context[rule.in].map((o) => o.id);
              return ids.includes(item[rule.key]);
            }
            if (rule.value) {
              const expected = rule.value
                .split(".")
                .reduce((acc, k) => acc?.[k], context);
              return item[rule.key] === expected;
            }
            return true;
          });
        });
      }

      payload = {items: entries};
      const file = jsonObjectToFile(payload, task.fileName);
      await remoteProvider.postFile(task.filePath, file);
      return file;
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
          config.localToRemote.remoteFolder +
            "/" +
            config.localToRemote.remoteFile,
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

async function updateSyncedAt(task, updatedAt) {
  try {
    const path = task.filePath;
    await updateSyncFile({path, updatedAt, syncAt: updatedAt});
  } catch (e) {
    console.error("[updateSyncedAt] Error updating syncFiles:", e);
  }
}
