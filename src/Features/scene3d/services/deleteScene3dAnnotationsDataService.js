import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import { evictScene3dTopViewTexture } from "./scene3dAssetsCache";
import { releaseScene3dTopViewUrl } from "../hooks/useScene3dTopViewUrl";

// Deletes the data owned by SCENE_3D annotations that were just deleted:
// the scan pieces (db.scene3dAssets) and the top view image (db.files).
// The scan is kept while another live annotation still shows it (a project
// duplicated on this device shares the sceneId of its source).
export default async function deleteScene3dAnnotationsDataService(annotations) {
  const scenes = (annotations ?? []).filter(
    (a) => a?.type === "SCENE_3D" && a.scene3d
  );
  if (scenes.length === 0) return;

  const deletedIds = new Set(scenes.map((a) => a.id));
  const sceneIds = new Set(
    scenes.map((a) => a.scene3d.sceneId).filter(Boolean)
  );
  const stillUsed = new Set();
  if (sceneIds.size > 0) {
    await db.annotations
      .filter(
        (a) =>
          a.type === "SCENE_3D" &&
          !a.deletedAt &&
          !deletedIds.has(a.id) &&
          sceneIds.has(a.scene3d?.sceneId)
      )
      .each((a) => stillUsed.add(a.scene3d.sceneId));
  }

  for (const sceneId of sceneIds) {
    if (!stillUsed.has(sceneId)) await deleteScene3dAssetsService(sceneId);
  }
  for (const annotation of scenes) {
    const fileName = annotation.scene3d.topView?.fileName;
    if (!fileName) continue;
    evictScene3dTopViewTexture(fileName);
    releaseScene3dTopViewUrl(fileName);
    await db.files.delete(fileName);
  }
}
