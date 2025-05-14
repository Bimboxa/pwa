import db from "App/db/db";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

import addIdToNodes from "Features/tree/utils/addIdToNodes";

export default async function fetchOrgaDataFolderService({
  orgaData,
  remoteProvider,
}) {
  console.log("[fetchRemoteOrgaDataService] test", orgaData);
  const files = await remoteProvider.downloadFilesFromFolder(orgaData.path);
  console.log("[donwloaded files]", files);
  //

  for (let file of files) {
    const remoteItem = orgaData.files.find((f) => f.fileName === file.name);
    let item;
    switch (remoteItem?.dataStructure) {
      case "NOMENCLATURE":
        const object = await jsonFileToObjectAsync(file);
        const _items = object.items || object.tree;
        item = {
          key: remoteItem.key,
          data: {
            ...object,
            items: addIdToNodes(_items),
          },
          dataStructure: remoteItem.dataStructure,
        };
        break;

      case "FILE":
        item = {
          key: remoteItem.key,
          file: file,
          dataStructure: remoteItem.dataStructure,
        };
        break;

      default:
        console.log("Unsupported data structure");
    }
    //
    await db.orgaData.put(item);
  }
}
