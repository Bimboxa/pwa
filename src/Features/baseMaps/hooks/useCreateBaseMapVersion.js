import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import generateThumbnail from "Features/images/utils/generateThumbnail";

async function getImageSizeFromFile(file) {
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

export default function useCreateBaseMapVersion() {
  return async (baseMapId, file, options = {}) => {
    const {
      label = "Nouvelle version",
      transform = { x: 0, y: 0, rotation: 0, scale: 1 },
    } = options;

    // data

    const record = await db.baseMaps.get(baseMapId);
    if (!record) return;

    const versions = record.versions || [];

    // helpers

    const versionId = nanoid();
    const fileExtension = file.name?.split(".").pop() || "png";
    const fileName = `version_${versionId}_${baseMapId}.${fileExtension}`;

    const [thumbnail, imageSize] = await Promise.all([
      generateThumbnail(file),
      getImageSizeFromFile(file),
    ]);

    // Store file binary in db.files
    const arrayBuffer = await file.arrayBuffer();
    await db.files.put({
      fileName,
      fileMime: file.type || "image/png",
      srcFileName: file.name,
      fileArrayBuffer: arrayBuffer,
      fileType: "IMAGE",
      projectId: record.projectId,
      listingId: record.listingId,
      entityId: baseMapId,
      listingTable: "baseMaps",
    });

    // Build version metadata
    const lastIndex =
      versions.length > 0
        ? versions[versions.length - 1].fractionalIndex
        : null;
    const fractionalIndex = generateKeyBetween(lastIndex, null);

    const newVersion = {
      id: versionId,
      label,
      fractionalIndex,
      isActive: true,
      image: {
        fileName,
        fileSize: file.size,
        imageSize,
        thumbnail,
        isImage: true,
        fileType: "IMAGE",
        fileUpdatedAt: new Date().toISOString(),
      },
      transform,
    };

    // Deactivate all existing versions, append the new one
    const updatedVersions = versions.map((v) => ({ ...v, isActive: false }));
    updatedVersions.push(newVersion);

    await db.baseMaps.update(baseMapId, { versions: updatedVersions });

    return newVersion;
  };
}
