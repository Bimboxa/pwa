import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import { isScene3dImporting } from "./scene3dImportingGuard";
import { getLocalScanHeightSceneId } from "Features/localScans/utils/localScanHeightSceneId";

// Garbage collection of db.scene3dAssets: deletes the scans no live scan
// base map references any more (base map deleted through a path that does
// not cascade — scope reset, project wiped — or import interrupted by a
// reload before the base map was created).
//
// Reads index keys only (never the binary rows). Run from a quiet, user-
// driven moment (opening the scan dialog), NOT from a background effect: a
// Krto import wipes then rewrites the base maps, and a purge in between
// would wrongly see every scan as orphan.
// → number of scans deleted
export default async function purgeOrphanScene3dAssetsService() {
  const sceneIds = await db.scene3dAssets.orderBy("sceneId").uniqueKeys();
  if (sceneIds.length === 0) return 0;

  // live scenes: the « Scène 3D » meshes and the height maps of the base
  // maps projected from a local point cloud (one row per base map)
  const baseMaps = await db.baseMaps
    .filter((b) => !b.deletedAt && Boolean(b.scene3d?.sceneId || b.localScan))
    .toArray();
  const liveSceneIds = new Set(
    baseMaps.map((b) =>
      b.scene3d?.sceneId ? b.scene3d.sceneId : getLocalScanHeightSceneId(b.id)
    )
  );

  let count = 0;
  for (const sceneId of sceneIds) {
    if (liveSceneIds.has(sceneId) || isScene3dImporting(sceneId)) continue;
    await deleteScene3dAssetsService(sceneId);
    count += 1;
  }
  return count;
}
