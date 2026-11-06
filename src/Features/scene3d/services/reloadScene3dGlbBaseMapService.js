import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import {
  deleteScene3dGlbFileService,
  getScene3dGlbFileName,
  saveScene3dGlbFileService,
} from "./scene3dGlbFileService";

// "Recharger les fichiers" of a GLB scan base map (the model file is missing
// on this device, or was re-exported): the new file is stored under a new
// scene id — the 3D editor re-attaches on the id change — and the previous
// one is deleted. The zone (image frame, rotation, plane altitude) is kept:
// the image, the scale and the annotations do not move.
export default async function reloadScene3dGlbBaseMapService({
  baseMapId,
  file,
}) {
  const record = await db.baseMaps.get(baseMapId);
  if (!record?.scene3d?.zone) throw new Error("Scan base map not found.");

  const previous = record.scene3d;
  const sceneId = nanoid();
  const glbFileName = getScene3dGlbFileName(sceneId);
  await saveScene3dGlbFileService({
    fileName: glbFileName,
    file,
    projectId: record.projectId,
  });
  await db.baseMaps.update(baseMapId, {
    scene3d: {
      ...previous,
      sceneId,
      glbFileName,
      srcFileName: file.name,
      storedBytes: file.size,
    },
  });
  if (previous.glbFileName && previous.glbFileName !== glbFileName) {
    await deleteScene3dGlbFileService(previous.glbFileName);
  }
}
