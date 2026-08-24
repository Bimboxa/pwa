import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

// Creates a new version of targetBaseMap from a source version (possibly of
// another baseMap): copies the image file, appends the version at the end of
// the fractional order and activates it. Shared by the tree and the left
// panel detail view (DialogCreateBaseMapVersion onConfirm).
export default async function createBaseMapVersionFromSource({
  targetBaseMap,
  label,
  sourceVersion,
}) {
  if (!targetBaseMap || !sourceVersion) return;

  // Copy the image file from the source version
  const versionId = nanoid();
  let newImage = sourceVersion.image;
  if (sourceVersion.image?.fileName) {
    const srcFile = await db.files.get(sourceVersion.image.fileName);
    if (srcFile) {
      const ext = sourceVersion.image.fileName.split(".").pop() || "png";
      const newFileName = `version_${versionId}_${targetBaseMap.id}.${ext}`;
      await db.files.put({
        ...srcFile,
        fileName: newFileName,
      });
      newImage = {
        ...sourceVersion.image,
        fileName: newFileName,
        fileUpdatedAt: new Date().toISOString(),
      };
    }
  }

  // Compute fractionalIndex
  const existingVersions = await db.baseMapVersions
    .where("baseMapId")
    .equals(targetBaseMap.id)
    .toArray();
  const sorted = existingVersions
    .filter((v) => !v.deletedAt)
    .sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  const lastIndex =
    sorted.length > 0 ? sorted[sorted.length - 1].fractionalIndex : null;

  // Deactivate all existing versions, then create the new one
  await activateBaseMapVersion(targetBaseMap.id, null);
  await db.baseMapVersions.put({
    id: versionId,
    baseMapId: targetBaseMap.id,
    projectId: targetBaseMap.projectId,
    listingId: targetBaseMap.listingId,
    label,
    fractionalIndex: generateKeyBetween(lastIndex, null),
    isActive: true,
    image: newImage,
    transform: { x: 0, y: 0, rotation: 0, scale: 1 },
  });
}
