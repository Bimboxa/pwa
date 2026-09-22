import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import generateThumbnail from "Features/images/utils/generateThumbnail";

export function getImageSizeFromFile(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// Prepares the db.files row + version image metadata for a replacement
// image, without writing (so callers can batch the writes in their own
// transaction). Returns { fileRecord, image }.
export async function prepareVersionImageReplacement({
  baseMapId,
  record,
  file,
  imageSize: knownImageSize,
}) {
  const fileExtension = file.name?.split(".").pop() || "png";
  const newFileName = `version_${nanoid()}_${baseMapId}.${fileExtension}`;

  const [thumbnail, imageSize, arrayBuffer] = await Promise.all([
    generateThumbnail(file),
    knownImageSize ?? getImageSizeFromFile(file),
    file.arrayBuffer(),
  ]);

  const fileRecord = {
    fileName: newFileName,
    fileMime: file.type || "image/png",
    srcFileName: file.name,
    fileArrayBuffer: arrayBuffer,
    fileType: "IMAGE",
    projectId: record.projectId,
    listingId: record.listingId,
    entityId: baseMapId,
    listingTable: "baseMaps",
  };

  const image = {
    fileName: newFileName,
    fileSize: file.size,
    imageSize,
    thumbnail,
    isImage: true,
    fileType: "IMAGE",
    fileUpdatedAt: new Date().toISOString(),
  };

  return { fileRecord, image };
}

// Replaces the image of an existing base map version in place (new db.files
// row, version image metadata updated, optional transform).
export default async function replaceVersionImageService(
  baseMapId,
  versionId,
  file,
  options = {}
) {
  const version = await db.baseMapVersions.get(versionId);
  if (!version) return;

  const record = await db.baseMaps.get(baseMapId);
  if (!record) return;

  const { fileRecord, image } = await prepareVersionImageReplacement({
    baseMapId,
    record,
    file,
  });

  await db.files.put(fileRecord);

  const update = { image };
  if (options.transform) {
    update.transform = options.transform;
  }
  await db.baseMapVersions.update(versionId, update);
}
