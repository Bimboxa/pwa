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
  const fetchMode = remoteToLocal?.fetchMode || "FILE";
  const postMode = localToRemote?.postMode || "MULTI_FILES";

  const folderPath = resolveTemplate(remoteFolder, {
    ...context,
    remoteProvider,
  });

  // If SINGLE_FILE mode, resolve once with context only
  if (postMode === "SINGLE_FILE") {
    const file = resolveTemplate(remoteFile, {...context, remoteProvider});
    const filePath = folderPath + file;

    const remoteMeta =
      fetchMode === "FOLDER"
        ? (await remoteProvider.fetchFilesMetadataFromFolder(folderPath)).find(
            (f) => f.path === filePath
          )
        : await remoteProvider.fetchFileMetadata(filePath);

    return [
      {
        filePath,
        table: localTable,
        direction,
        localFilter: {},
        updatedAtRemote: remoteMeta?.lastModifiedAt,
        label: `${syncFileType}: ${file}`,
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
      if (fetchMode === "FOLDER") {
        remoteMeta = folderFilesMeta.find((f) => f.path === filePath);
      } else {
        remoteMeta = await remoteProvider.fetchFileMetadata(filePath);
      }

      return {
        filePath,
        table: localTable,
        direction,
        localFilter,
        updatedAtRemote: remoteMeta?.lastModifiedAt,
        label: `${syncFileType}: ${file}`,
      };
    })
  );

  return tasks;
}
