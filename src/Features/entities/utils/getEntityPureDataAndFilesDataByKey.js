import testIsPngImage from "Features/files/utils/testIsPngImage";
import getDateString from "Features/misc/utils/getDateString";
import getFileIdFromEntityAndFile from "./getFileIdFromEntityAndFile";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

export default async function getEntityPureDataAndFilesDataByKey(
  entity,
  options
) {
  // edge case

  if (!entity || (!entity.id && !options.entityId)) return;

  // data - options

  const entityId = entity.id ?? options.entityId;
  const listingId = options?.listingId;
  const listingTable = options?.listingTable;
  const createdBy = options?.createdBy;
  const projectId = options?.projectId;

  // init

  const pureData = {};
  const filesDataByKey = {};
  let testHasFiles = false;

  // loop

  const keyValues = Object.entries(entity) ?? [];
  for (const [key, value] of keyValues) {
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
      const fileArrayBuffer = await value.file.arrayBuffer();
      const fileData = {
        fileName,
        //file: value.file,
        fileMime: value.file.type,
        fileArrayBuffer,
        projectId,
        listingId,
        listingTable,
        createdBy,
        createdAt,
        updatedAt: createdAt,
      };
      if (isImage) fileData.fileType = "IMAGE";

      // pureData
      const newValue = { ...value };
      delete newValue.file;
      newValue.fileName = fileName;
      if (isImage) {
        newValue.isImage = true;
        newValue.imageSize = await getImageSizeAsync(URL.createObjectURL(value.file))
      }
      pureData[key] = newValue;

      // filesDataByKey
      filesDataByKey[key] = fileData;
    } else {
      pureData[key] = value;
    }
  }

  // add projectId
  pureData.projectId = projectId;

  console.log("[getPureData] entity pureData", pureData);
  // response
  const response = { pureData };
  if (testHasFiles) response.filesDataByKey = filesDataByKey;
  return response;
}
