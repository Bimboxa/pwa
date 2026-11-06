import db from "App/db/db";

import { evictScene3dGlb } from "./scene3dGlbCache";

// The GLB file of a scan base map (scene3d.format "GLB") in db.files — same
// row shape as the source file of a point cloud resource
// (createScanResourceStore): the Blob as is, no listing.

export function getScene3dGlbFileName(sceneId) {
  return `scene3d_${sceneId}.glb`;
}

export async function saveScene3dGlbFileService({ fileName, file, projectId }) {
  await db.files.put({
    fileName,
    fileBlob: file,
    projectId,
    fileMime: "model/gltf-binary",
    srcFileName: file.name,
    fileType: "GLB",
  });
}

export async function deleteScene3dGlbFileService(fileName) {
  if (!fileName) return;
  evictScene3dGlb(fileName);
  await db.files.delete(fileName);
}
