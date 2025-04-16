// resolveSyncTasks.js

import db from "App/db/db";
import resolveTemplate from "../utils/resolveTemplate";

/**
 * @param {Object} config - A syncConfig entry
 * @param {Object} context - project, listing, scope, etc.
 * @param {Object} remoteProvider - remote API abstraction
 * @returns {Promise<SyncTask[]>}
 */
export default async function resolveSyncTasks(
  config,
  context,
  remoteProvider
) {
  const {
    remoteFolder,
    remoteFile,
    localToRemote,
    remoteToLocal,
    direction,
    localTable,
    syncFileType,
  } = config;

  const filterBy = localToRemote?.filterBy || [];
  const findEntry = localToRemote?.findEntry || [];
  const fetchMode = remoteToLocal?.fetchMode || "FILE";
  const postMode = localToRemote?.postMode || "SINGLE_FILE";

  const folderPath = resolveTemplate(remoteFolder, {
    ...context,
    remoteProvider,
  });

  // SINGLE_FILE mode with findEntry
  if (postMode === "SINGLE_FILE" && findEntry?.length) {
    const localFilter = {};
    for (const rule of findEntry) {
      const val = resolveTemplate(`{{${rule.value}}}`, context);
      localFilter[rule.key] = val;
    }

    const file = resolveTemplate(remoteFile, {...context, remoteProvider});
    const filePath = folderPath + file;

    let remoteMeta = null;
    try {
      remoteMeta =
        fetchMode === "FOLDER"
          ? (
              await remoteProvider.fetchFilesMetadataFromFolder(folderPath)
            ).find((f) => f.path === filePath)
          : await remoteProvider.fetchFileMetadata(filePath);
    } catch (err) {
      if (err?.error?.path?.[".tag"] !== "not_found") throw err;
    }

    return [
      {
        filePath,
        table: localTable,
        direction,
        localFilter,
        updatedAtRemote: remoteMeta?.lastModifiedAt,
      },
    ];
  }

  // MULTI_FILES mode: build list of unique key combinations from Dexie
  const allItems = await db[localTable].toArray();
  const uniqueKeys = new Set();
  const filters = [];

  for (const item of allItems) {
    const key = filterBy.map((k) => item[k]).join("::");
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      const localFilter = {};
      filterBy.forEach((k) => {
        localFilter[k] = item[k];
      });
      filters.push(localFilter);
    }
  }

  let folderFilesMeta = [];
  if (fetchMode === "FOLDER") {
    folderFilesMeta = await remoteProvider.fetchFilesMetadataFromFolder(
      folderPath
    );
  }

  const tasks = await Promise.all(
    filters.map(async (localFilter) => {
      const folder = folderPath; // already resolved
      const file = resolveTemplate(remoteFile, {
        ...context,
        ...localFilter,
        remoteProvider,
      });
      const filePath = folder + file;

      let remoteMeta = null;
      try {
        remoteMeta =
          fetchMode === "FOLDER"
            ? folderFilesMeta.find((f) => f.path === filePath)
            : await remoteProvider.fetchFileMetadata(filePath);
      } catch (err) {
        console.log("error", err);
      }

      return {
        filePath,
        table: localTable,
        direction,
        localFilter,
        updatedAtRemote: remoteMeta?.lastModifiedAt,
      };
    })
  );

  return tasks;
}
