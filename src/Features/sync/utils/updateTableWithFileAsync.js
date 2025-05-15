import db from "App/db/db";

import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";
import getDynamicVariablesFromTemplate from "../utils/getDynamicVariablesFromTemplate";

export default async function updateTableWithFileAsync({
  table,
  file,
  filePath,
  pathToItemTemplate,
  itemPath,
  fileType,
  updatedAt,
}) {
  try {
    // edge case
    if (!table || !file) return null;

    // helper - switch

    let writeMode = "TO_JSON";
    if (pathToItemTemplate) {
      writeMode = "TO_FILE";
    }

    // main
    switch (writeMode) {
      case "TO_JSON":
        {
          const object = await jsonFileToObjectAsync(file);
          if (object?.data) {
            db[table].put(object.data);
          } else if (object?.items) {
            db[table].bulkPut(object.items);
          }
        }
        break;

      case "TO_FILE": {
        const props = getDynamicVariablesFromTemplate(
          itemPath,
          pathToItemTemplate
        );
        console.log("debug_2804 props", props, filePath, pathToItemTemplate);
        const listingId = props?.listingId;
        const createdBy = props?.createdBy;
        const fileName = filePath.split("/").pop();
        const fileItem = {
          file,
          fileName,
          listingId,
          createdBy,
          fileType,
          updatedAt,
        };
        db[table].put(fileItem);
        break;
      }
    }
  } catch (e) {
    console.log("error writing in db", e);
  }
}
