import testIsPngImage from "Features/files/utils/testIsPngImage";
import getDateString from "Features/misc/utils/getDateString";
import getFileIdFromEntityAndFile from "./getFileIdFromEntityAndFile";

export default function getEntityPureDataAndFilesDataByKey(entity, options) {
  // edge case

  if (!entity || (!entity.id && !options.entityId)) return;

  // data - options

  const entityId = entity.id ?? options.entityId;
  const listingId = options?.listingId;
  const createdBy = options?.createdBy;
  const projectId = options?.projectId;

  // init

  const pureData = {};
  const filesDataByKey = {};
  let testHasFiles = false;

  // loop

  Object.entries(entity).forEach(([key, value]) => {
    if (value && value.file instanceof File) {
      // test
      testHasFiles = true;

      // helpers
      const extension = value.file.name.split(".").pop();
      const isImage = [
        "png",
        "PNG",
        "jpg",
        "JPG",
        "jpeg",
        "JPEG",
        "gif",
      ].includes(extension);
      const createdAt = getDateString(Date.now());

      // fileData
      const fileName = getFileIdFromEntityAndFile({
        entityId,
        file: value.file,
        key,
      });
      const fileData = {
        fileName,
        file: value.file,
        listingId,
        createdBy,
        createdAt,
        updatedAt: createdAt,
      };
      if (isImage) fileData.fileType = "IMAGE";

      // pureData
      const newValue = { ...value };
      delete newValue.file;
      newValue.fileName = fileName;
      if (isImage) newValue.isImage = true;
      pureData[key] = newValue;

      // filesDataByKey
      filesDataByKey[key] = fileData;
    } else {
      pureData[key] = value;
    }
  });

  // add projectId
  pureData.projectId = projectId;

  console.log("[getPureData] entity pureData", pureData);
  // response
  const response = { pureData };
  if (testHasFiles) response.filesDataByKey = filesDataByKey;
  return response;
}
