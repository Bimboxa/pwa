/*
 * output : [{filePath,updatedAtRemote}]
 */

import resolveComputedContext from "../utils/resolveComputedContext";
import {resolveFilePath} from "../utils/resolversPath";
import resolveStringFromContext from "../utils/resolveStringFromContext";
import resolveFilters from "../utils/resolveFilters";
import getTableEntriesFromFilters from "../utils/getTableEntriesFromFilters";
import groupItemsByKeys from "Features/misc/utils/groupItemsByKeys";

import db from "App/db/db";

export default async function resolveSyncFilesLocal(config, context) {
  // edge case
  if (!config || !context) return [];

  // helpers

  const fileTemplate = config.syncFile.remoteFile;
  const folderTemplate = config.syncFile.remoteFolder;
  const table = config.syncFile.localData.table;

  const computedContext = config.computedContext;

  const mode = config.localToRemote.mode;
  const entryToResolve = config.localToRemote.entry;
  const filterEntriesToResolve = config.localToRemote.filterEntries;
  const groupEntriesBy = config.localToRemote.groupEntriesBy;

  // helper - context

  const computedContextResolved = resolveComputedContext(
    computedContext,
    context
  );
  context = {...context, ...computedContextResolved};

  //mai
  switch (mode) {
    case "SINGLE_FILE": {
      if (entryToResolve) {
        const item = resolveStringFromContext(entryToResolve, context);
        const filePath = resolveFilePath({
          folderTemplate,
          fileTemplate,
          context,
          item,
        });
        const syncFile = await db.syncFiles.get(filePath);
        const updatedAtLocal = syncFile?.updatedAt;
        //
        return [{filePath, updatedAtLocal, entry: item}];
      } else {
        return null;
      }
    }

    case "ONE_FILE_BY_ENTRY": {
      if (filterEntriesToResolve) {
        const filters = resolveFilters(filterEntriesToResolve, context);
        const items = await getTableEntriesFromFilters(table, filters);
        console.log("debug_2222 one_file_by_entry", items, filters, table);

        if (!items) return [];

        return await Promise.all(
          items.map(async (item) => {
            const filePath = resolveFilePath({
              folderTemplate,
              fileTemplate,
              context,
              item,
            });
            const syncFile = await db.syncFiles.get(filePath);
            const updatedAtLocal = syncFile?.updatedAt;
            return {filePath, updatedAtLocal};
          })
        );
      }
    }

    case "GROUP_ENTRIES_BY_FILE": {
      if (filterEntriesToResolve && groupEntriesBy) {
        const filters = resolveFilters(filterEntriesToResolve, context);
        const entries = await getTableEntriesFromFilters(table, filters);
        const groupedEntries = groupItemsByKeys(entries, groupEntriesBy);

        if (!groupedEntries) return [];

        return await Promise.all(
          Object.entries(groupedEntries).map(async ([keysString, entries]) => {
            const keys = keysString.split("::");
            const item = groupEntriesBy.reduce((acc, key, index) => {
              acc[key] = keys[index];
              return acc;
            }, {});
            const filePath = resolveFilePath({
              folderTemplate,
              fileTemplate,
              context,
              item,
            });
            const syncFile = await db.syncFiles.get(filePath);
            const updatedAtLocal = syncFile?.updatedAt;
            return {filePath, updatedAtLocal, entries};
          })
        );
      }
    }
  }
}
