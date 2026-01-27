import { nanoid } from "@reduxjs/toolkit";
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
  const listingId = entity.listingId ?? options?.listingId;
  const listingTable = options?.listingTable;
  const createdBy = options?.createdBy;
  const projectId = entity?.projectId ?? options?.projectId;

  // init
  const pureData = {};
  const filesDataByKey = {};
  let testHasFiles = false;

  // --- INTERNAL HELPER ---
  const processFileItem = async (itemValue, itemKey) => {
    // helpers
    const extension = itemValue.file.name.split(".").pop();
    const isImage = [
      "png", "PNG", "jpg", "JPG", "jpeg", "JPEG", "gif",
    ].includes(extension);
    const createdAt = getDateString(Date.now());

    // fileData construction
    // On utilise l'itemKey qui contient maintenant le nanoid
    const fileName = getFileIdFromEntityAndFile({
      entityId,
      file: itemValue.file,
      key: itemKey,
    });

    const fileArrayBuffer = await itemValue.file.arrayBuffer();

    const fileData = {
      fileName,
      fileMime: itemValue.file.type,
      fileArrayBuffer,
      projectId,
      listingId,
      listingTable,
      createdBy,
      createdAt,
      updatedAt: createdAt,
    };

    if (isImage) fileData.fileType = "IMAGE";

    // pureData construction
    const pureDataItem = { ...itemValue };
    delete pureDataItem.file;
    pureDataItem.fileName = fileName;

    if (isImage) {
      pureDataItem.isImage = true;
      pureDataItem.imageSize = await getImageSizeAsync(
        URL.createObjectURL(itemValue.file)
      );
    }

    return { pureDataItem, fileData };
  };
  // -----------------------

  // loop
  const keyValues = Object.entries(entity) ?? [];

  for (const [key, value] of keyValues) {

    // CAS 1 : Gestion du champ "images" (Tableau de fichiers)
    if (key === "images" && Array.isArray(value)) {
      const pureDataImages = [];
      const filesDataImages = [];

      // On utilise une boucle for...of ici, l'index n'est plus nécessaire pour l'ID
      for (const item of value) {
        if (item && item.file instanceof File) {
          testHasFiles = true;

          // GENERATION DU NANOID ICI
          // Cela crée une clé unique stable : images_V1StGXR8_Z5jdHi6B-myT
          const uniqueKey = `${key}_${nanoid()}`;

          const { pureDataItem, fileData } = await processFileItem(item, uniqueKey);

          pureDataImages.push(pureDataItem);
          filesDataImages.push(fileData);
        } else {
          pureDataImages.push(item);
        }
      }

      pureData[key] = pureDataImages;
      if (filesDataImages.length > 0) {
        filesDataByKey[key] = filesDataImages;
      }
    }

    // CAS 2 : Champ fichier simple
    else if (value && value.file instanceof File) {
      testHasFiles = true;
      const { pureDataItem, fileData } = await processFileItem(value, key);

      pureData[key] = pureDataItem;
      filesDataByKey[key] = fileData;
    }

    // CAS 3 : Donnée standard
    else {
      pureData[key] = value;
    }
  }

  // add projectId
  pureData.projectId = projectId;

  console.log("[getPureData] entity pureData", pureData);

  const response = { pureData };
  if (testHasFiles) response.filesDataByKey = filesDataByKey;

  return response;
}