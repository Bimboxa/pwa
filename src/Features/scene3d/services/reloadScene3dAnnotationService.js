import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import persistScene3dTopViewService from "./persistScene3dTopViewService";
import { evictScene3dTopViewTexture } from "./scene3dAssetsCache";
import { releaseScene3dTopViewUrl } from "../hooks/useScene3dTopViewUrl";

// "Recharger les fichiers": points an existing SCENE_3D annotation at a
// freshly imported scan (its data was missing on this device, or the scan
// was re-exported). The annotation keeps its centre, rotation and altitude;
// the previous scan data and top view are deleted.
// imported: the result of importScene3dFilesService.
export default async function reloadScene3dAnnotationService({
  annotationId,
  imported,
}) {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) throw new Error("Annotation not found.");

  const previous = annotation.scene3d;
  const topView = await persistScene3dTopViewService({
    topView: imported.topView,
    projectId: annotation.projectId,
    listingId: annotation.listingId,
    annotationId,
  });
  await db.annotations.update(annotationId, {
    scene3d: { ...imported.descriptor, topView },
  });

  if (previous?.sceneId && previous.sceneId !== imported.descriptor.sceneId) {
    await deleteScene3dAssetsService(previous.sceneId);
  }
  const previousFileName = previous?.topView?.fileName;
  if (previousFileName) {
    evictScene3dTopViewTexture(previousFileName);
    releaseScene3dTopViewUrl(previousFileName);
    await db.files.delete(previousFileName);
  }
}
