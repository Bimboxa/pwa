import db from "App/db/db";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

import addIdToNodes from "Features/tree/utils/addIdToNodes";

export default async function fetchRemoteOrgaDataService({
  orgaData,
  remoteProvider,
}) {
  console.log("[fetchRemoteOrgaDataService] orgaData", orgaData.key);
  const test = await remoteProvider.fetchFileMetadata(orgaData.remotePath);
  console.log("[fetchRemoteOrgaDataService] test", test);
  const file = await remoteProvider.downloadFile(test.id);
  console.log("[donwloaded file]", file);
  //
  let item;
  //
  switch (orgaData.dataStructure) {
    case "NOMENCLATURE":
      const object = await jsonFileToObjectAsync(file);
      const _items = object.items || object.tree;
      item = {
        key: orgaData.key,
        data: {
          ...object,
          items: addIdToNodes(_items),
        },
        dataStructure: orgaData.dataStructure,
      };
      break;

    case "FILE":
      console.log("[fetchRemoteOrgaDataService] orgaData2", orgaData);
      item = {
        key: orgaData.key,
        file: file,
        dataStructure: orgaData.dataStructure,
      };
      break;

    default:
      throw new Error("Unsupported data structure");
  }
  //
  await db.orgaData.put(item);
}
