import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import generateThumbnail from "Features/images/utils/generateThumbnail";

function getImageSizeFromFile(file) {
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

export default function useReplaceVersionImage() {
  return async (baseMapId, versionId, file) => {
    const record = await db.baseMaps.get(baseMapId);
    if (!record?.versions) return;

    const version = record.versions.find((v) => v.id === versionId);
    if (!version) return;

    // Store new file in db.files
    const fileExtension = file.name?.split(".").pop() || "png";
    const newFileName = `version_${nanoid()}_${baseMapId}.${fileExtension}`;

    const [thumbnail, imageSize, arrayBuffer] = await Promise.all([
      generateThumbnail(file),
      getImageSizeFromFile(file),
      file.arrayBuffer(),
    ]);

    await db.files.put({
      fileName: newFileName,
      fileMime: file.type || "image/png",
      srcFileName: file.name,
      fileArrayBuffer: arrayBuffer,
      fileType: "IMAGE",
      projectId: record.projectId,
      listingId: record.listingId,
      entityId: baseMapId,
      listingTable: "baseMaps",
    });

    // Update version's image metadata
    const updatedVersions = record.versions.map((v) =>
      v.id === versionId
        ? {
            ...v,
            image: {
              fileName: newFileName,
              fileSize: file.size,
              imageSize,
              thumbnail,
              isImage: true,
              fileType: "IMAGE",
              fileUpdatedAt: new Date().toISOString(),
            },
          }
        : v
    );

    await db.baseMaps.update(baseMapId, { versions: updatedVersions });
  };
}
