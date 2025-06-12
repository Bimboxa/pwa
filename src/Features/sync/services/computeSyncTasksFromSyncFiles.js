import db from "App/db/db";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeSyncFileGetItemsRules from "../utils/computeSyncFileGetItemsRules";
import computeSyncFilePathTemplates from "../utils/computeSyncFilePathTemplates";

import getDynamicVariablesFromTemplate from "../utils/getDynamicVariablesFromTemplate";

export default async function computeSyncTasksFromSyncFiles({
  context,
  syncFiles,
}) {
  try {
    let tasks = [];

    // helpers - listings

    const listingsIds = syncFiles
      .filter((sf) => sf.listingId)
      .map((sf) => sf.listingId);
    const listings = await db.listings.bulkGet(listingsIds);
    const listingsById = getItemsByKey(listings, "id");

    // main

    let id = 1;
    for (let syncFile of syncFiles) {
      // helpers
      const {syncFileType, fileType, path, listingId} = syncFile;
      const {getItemFromKey, getItemsFromKeys} = computeSyncFileGetItemsRules({
        syncFileType,
      });

      //
      console.log(
        "debug_2805 getItemsFromKeys",
        getItemsFromKeys,
        syncFileType
      );
      //
      const {remoteFile, remoteFolder} = computeSyncFilePathTemplates({
        syncFileType,
        fileType,
      });
      const pathTemplate = remoteFolder + "/" + remoteFile;

      // listing
      const listing = listingsById[listingId];

      // table
      const tableBySyncFileType = {
        RPOJECT: "projects",
        SCOPE: "scopes",
        LISTING: "listings",
        ENTITIES: listing.table,
        MARKERS: "markers",
        ZONING: listing.table,
        FILE: "files",
      };
      const table = tableBySyncFileType[syncFileType];

      // dynamic variables
      const dynamicVariables = getDynamicVariablesFromTemplate(
        path,
        pathTemplate,
        context
      );

      console.log(
        "dynamicVariables",
        path,
        pathTemplate,
        context,
        dynamicVariables
      );

      if (dynamicVariables) {
        // content
        let content;
        if (["PROJECT", "SCOPE", "LISTING", "ZONING"].includes(syncFileType)) {
          content = "DATA";
        } else if (["ENTITIES"].includes(syncFileType)) {
          content = "ITEMS";
        } else if (["FILE"].includes(syncFileType)) {
          content = "FILE";
        }

        // entries & entry & write mode

        let entry;
        let entries;
        let writeMode;

        switch (content) {
          case "DATA":
            const itemKey = dynamicVariables[getItemFromKey];
            entry = await db[table].get(itemKey);
            break;

          case "ITEMS":
            const whereArg = `[${getItemsFromKeys.join("+")}]`;
            const itemsKeys = getItemsFromKeys.map(
              (key) => dynamicVariables[key]
            );
            console.log("debug_2805", table, whereArg, itemsKeys);
            entries = await db[table]
              .where(whereArg)
              .equals(itemsKeys)
              .toArray();
            break;

          case "FILE":
            const fileName = dynamicVariables[getItemFromKey];
            try {
              entry = await db[table].get(dynamicVariables[getItemFromKey]);
              writeMode = "TABLE_ENTRY_TO_FILE";
            } catch (e) {
              console.error(
                e,
                table,
                fileName,
                getItemFromKey,
                dynamicVariables
              );
            }
            break;
          default:
            break;
        }

        // task

        const newTask = {
          id: `task_${id}`,
          syncFileKey: syncFileType,
          filePath: path,
          action: "PUSH",
          writeMode,
          //writeMode: "TABLE_ENTRY_TO_FILE", // NO ! it depends on the syncFileType.
          entry,
          entries,
          updatedAtLocal: syncFile.updatedAt,
        };
        tasks.push(newTask);
        id++;
      }
    }

    // return
    return tasks;
  } catch (e) {
    console.log("error", e);
  }
}
