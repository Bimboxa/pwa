import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

const EXTENSION_BY_MIME = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

// Writes the top view image of a scan to db.files — the only binary of a
// SCENE_3D annotation that travels in the Krto zip (the scan itself stays in
// the local-only db.scene3dAssets table).
// topView: {blob, fileMime, width, height, pxPerMeter}
// → the `scene3d.topView` reference stored on the annotation.
export default async function persistScene3dTopViewService({
  topView,
  projectId,
  listingId,
  annotationId,
}) {
  const extension = EXTENSION_BY_MIME[topView.fileMime] ?? "png";
  const fileName = `scene3dTopView_${nanoid()}.${extension}`;
  await db.files.put({
    fileName,
    srcFileName: fileName,
    fileMime: topView.fileMime,
    fileArrayBuffer: await topView.blob.arrayBuffer(),
    projectId,
    listingId,
    entityId: annotationId,
    listingTable: "annotations",
  });
  return {
    fileName,
    fileMime: topView.fileMime,
    width: topView.width,
    height: topView.height,
    pxPerMeter: topView.pxPerMeter,
  };
}
