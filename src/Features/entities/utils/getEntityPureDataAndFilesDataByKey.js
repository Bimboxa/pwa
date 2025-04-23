import testIsPngImage from "Features/files/utils/testIsPngImage";
import getDateString from "Features/misc/utils/getDateString";

export default function getEntityPureDataAndFilesDataByKey(entity, options) {
  // edge case

  if (!entity || (!entity.id && !options.entityId)) return;

  // data

  const entityId = entity.id ?? options.entityId;
  const listingId = options?.listingId;

  // init

  const pureData = {};
  const filesDataByKey = {};
  let testHasFiles = false;

  // loop

  console.log("[getPureData] entity", entity);
  Object.entries(entity).forEach(([key, value]) => {
    if (value && value.file instanceof File) {
      // test
      testHasFiles = true;

      // fileData
      const fileId = key + "::" + entityId;
      const fileData = {
        id: fileId,
        file: value.file,
        listingId,
        entityId,
        entityKey: key,
        name: value.file.name,
        size: value.file.size,
        type: value.file.type,
        lastModifiedAt: getDateString(value.file.lastModified),
      };

      // pureData
      const newValue = {...value};
      delete newValue.file;
      newValue.fileId = fileId;
      if (testIsPngImage(value.file)) newValue.isImage = true;
      pureData[key] = newValue;

      // filesDataByKey
      filesDataByKey[key] = fileData;
    } else {
      pureData[key] = value;
    }
  });

  // response
  const response = {pureData};
  if (testHasFiles) response.filesDataByKey = filesDataByKey;
  return response;
}
