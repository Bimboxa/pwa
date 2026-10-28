import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import { getLocalScanHeightSceneId } from "Features/localScans/utils/localScanHeightSceneId";

// Deletes the scan data of base maps that were just deleted. Base maps are
// soft-deleted but the scan data is not: it goes for good (no restore path
// for base maps). A scan still referenced by another live base map (a
// project duplicated on this device keeps `scene3d` verbatim under new base
// map ids) is kept.
// The height map of a base map projected from a local point cloud (one row
// per base map) goes with it; the point cloud itself is a project resource.
// records: the db.baseMaps rows, read BEFORE the deletion.
export default async function deleteScene3dBaseMapsDataService(records) {
  for (const record of records ?? []) {
    if (!record?.localScan) continue;
    try {
      await deleteScene3dAssetsService(getLocalScanHeightSceneId(record.id));
    } catch (error) {
      console.error("[localScans] failed to delete the height map", error);
    }
  }
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
