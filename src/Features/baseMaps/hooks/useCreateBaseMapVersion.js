import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import generateThumbnail from "Features/images/utils/generateThumbnail";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

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

    // Compute fractionalIndex from existing versions in the table
    const existingVersions = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const activeVersions = existingVersions
      .filter((v) => !v.deletedAt)
      .sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      );
    const lastIndex =
      activeVersions.length > 0
        ? activeVersions[activeVersions.length - 1].fractionalIndex
        : null;
    const fractionalIndex = generateKeyBetween(lastIndex, null);

    const newVersion = {
      id: versionId,
      baseMapId,
      projectId: record.projectId,
      listingId: record.listingId,
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

    // Deactivate all existing versions, then create the new one
    await activateBaseMapVersion(baseMapId, null);
    await db.baseMapVersions.put(newVersion);

    return newVersion;
  };
}
