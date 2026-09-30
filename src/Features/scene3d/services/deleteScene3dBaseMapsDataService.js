import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";

// Deletes the scan data of base maps that were just deleted. Base maps are
// soft-deleted but the scan data is not: it goes for good (no restore path
// for base maps). A scan still referenced by another live base map (a
// project duplicated on this device keeps `scene3d` verbatim under new base
// map ids) is kept.
// records: the db.baseMaps rows, read BEFORE the deletion.
export default async function deleteScene3dBaseMapsDataService(records) {
  const sceneIds = [
    ...new Set((records ?? []).map((r) => r?.scene3d?.sceneId).filter(Boolean)),
  ];
  if (sceneIds.length === 0) return;
  const deletedIds = new Set(records.map((r) => r.id));
  const stillUsed = await db.baseMaps
    .filter(
      (b) =>
        !b.deletedAt &&
        !deletedIds.has(b.id) &&
        sceneIds.includes(b.scene3d?.sceneId)
    )
    .toArray();
  const usedSceneIds = new Set(stillUsed.map((b) => b.scene3d.sceneId));
  for (const sceneId of sceneIds) {
    if (usedSceneIds.has(sceneId)) continue;
    try {
      await deleteScene3dAssetsService(sceneId);
    } catch (error) {
      console.error("[scene3d] failed to delete the scan data", error);
    }
  }
}
