/*
 * Upload the file related to the syncFile item in the syncFiles table.
 */

import db from "App/db/db";

import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import getDynamicVariablesFromTemplate from "../utils/getDynamicVariablesFromTemplate";
import updateSyncFile from "./updateSyncFile";

import getDateString from "Features/misc/utils/getDateString";

export default async function uploadSyncFile({
  remoteProvider,
  syncFile,
  context,
}) {
  const syncFileType = syncFile?.syncFileType;
  const filePath = syncFile?.path;

  const syncFileConfig = syncFile?.config;

  const remoteFolder = syncFileConfig?.remoteFolder;
  const remoteFile = syncFileConfig?.remoteFile;
  const getItemFromKey = syncFileConfig?.localData.getItemFromKey;
  const getItemsFromKeys = syncFileConfig?.localData.getItemsFromKeys;
  const table = syncFileConfig?.localData.table;

  const filePathTemplate = remoteFolder + "/" + remoteFile;

  // edge case
  if (!syncFileType || !filePath) return;

  // main
  const dynamicVariables = getDynamicVariablesFromTemplate(
    filePath,
    filePathTemplate,
    context
  );

  let content = null;
  if (getItemFromKey && syncFileType !== "IMAGE") content = "DATA";
  if (getItemFromKey && syncFileType === "IMAGE") content = "IMAGE";
  if (getItemsFromKeys) content = "ITEMS";

  let fileContent = {error: "no content"};
  let file;

  switch (content) {
    case "DATA":
      const itemKey = dynamicVariables[getItemFromKey];
      const item = await db[table].get(itemKey);
      if (item) {
        fileContent = {data: item};
        const fileName = filePath.split("/").pop();
        file = jsonObjectToFile(fileContent, fileName);
      } else {
        console.error(
          "[uploadSyncFile] No item found for key:",
          getItemFromKey
        );
      }
      break;

    case "ITEMS":
      const whereArg = `[${getItemsFromKeys.join("+")}]`;
      const itemsKeys = getItemsFromKeys.map((key) => dynamicVariables[key]);
      const items = await db[table].where(whereArg).equals(itemsKeys).toArray();
      console.log("[uploadSyncFile] itemsKeys", whereArg, itemsKeys, items);
      if (items) {
        fileContent = {items};
        const fileName = filePath.split("/").pop();
        file = jsonObjectToFile(fileContent, fileName);
      } else {
        console.error("[uploadSyncFile] No items found for key:", itemsKeys);
      }
    default:
      break;

    case "IMAGE":
      console.log("[UploadSyncFile] image dynamicVariables", dynamicVariables);
      const fileItem = await db[table].get(dynamicVariables[getItemFromKey]);
      file = fileItem?.file;
  }

  const updatedAt = getDateString(file.lastModified);
  const uploadResult = await remoteProvider.postFile({path: filePath, file});
  console.log("[File uploaded]", uploadResult);
  await updateSyncFile({path: filePath, updatedAt, syncAt: updatedAt});
}
