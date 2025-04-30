import db from "App/db/db";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

import addIdToNodes from "Features/tree/utils/addIdToNodes";

export default async function fetchRemoteOrgaDataService({
  orgaData,
  remoteProvider,
}) {
  const file = await remoteProvider.downloadFile(orgaData.remotePath);
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
      item = {
        key: orgaData.key,
        file: file,
        dataStructure: orgaData.dataStructure,
      };
      break;
  }
  //
  await db.orgaData.put(item);
}
