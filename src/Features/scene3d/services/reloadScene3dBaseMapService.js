import db from "App/db/db";

import clipScene3dAssetsService from "./clipScene3dAssetsService";
import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import { unmarkScene3dImporting } from "./scene3dImportingGuard";
import { getScene3dBaseMapStoredBytes } from "../utils/getScene3dBaseMapDescriptor";

// "Recharger les fichiers": points an existing scan base map at a freshly
// imported scan (its data was missing on this device — Krto received from
// another one — or the scan was re-exported). The stored zone (polygon,
// rotation, plane altitude zMin) is applied to the new scan: the base map
// image, its scale and the annotations drawn on it do not move. The
// previous scan data is deleted.
// imported: the result of importScene3dFilesService.
export default async function reloadScene3dBaseMapService({
  baseMapId,
  imported,
  onProgress,
}) {
  const record = await db.baseMaps.get(baseMapId);
  if (!record?.scene3d?.zone) throw new Error("Scan base map not found.");

  const previous = record.scene3d;
  const { descriptor } = imported;
  const clipped = await clipScene3dAssetsService({
    sceneId: descriptor.sceneId,
    projectId: record.projectId,
    bbox: descriptor.bbox,
    polygon: previous.zone.polygon,
    onProgress,
  });

  await db.baseMaps.update(baseMapId, {
    scene3d: {
      ...previous,
      sceneId: descriptor.sceneId,
      srcFileName: descriptor.srcFileName,
      origin: descriptor.origin,
      bbox: descriptor.bbox,
      vertexCount: clipped.vertexCount,
      faceCount: clipped.faceCount,
      atlasCount: descriptor.atlasCount,
      storedBytes: getScene3dBaseMapStoredBytes(descriptor, clipped),
      // zone kept as is (zMin / zMax included: the plane stays where the
      // annotations were drawn)
    },
  });
  unmarkScene3dImporting(descriptor.sceneId);

  if (previous.sceneId && previous.sceneId !== descriptor.sceneId) {
    await deleteScene3dAssetsService(previous.sceneId);
  }
}
