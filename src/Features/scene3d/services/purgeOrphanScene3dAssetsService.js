import db from "App/db/db";

import deleteScene3dAssetsService from "./deleteScene3dAssetsService";
import { isPendingScene3d } from "./scene3dPendingStore";

// Garbage collection of db.scene3dAssets: deletes the scans no live SCENE_3D
// annotation references any more (annotation deleted through a path that
// does not cascade — listing deletion, scope reset — or import interrupted
// by a reload before the placement click).
//
// Reads index keys only (never the binary rows). Run from a quiet, user-
// driven moment (opening the import dialog), NOT from a background effect:
// a Krto import wipes then rewrites the annotations, and a purge in between
// would wrongly see every scan as orphan.
// → number of scans deleted
export default async function purgeOrphanScene3dAssetsService() {
  const sceneIds = await db.scene3dAssets.orderBy("sceneId").uniqueKeys();
  if (sceneIds.length === 0) return 0;

  const annotations = await db.annotations
    .filter((a) => a.type === "SCENE_3D" && !a.deletedAt && !!a.scene3d)
    .toArray();
  const listingIds = [
    ...new Set(annotations.map((a) => a.listingId).filter(Boolean)),
  ];
  const listings =
    listingIds.length > 0 ? await db.listings.bulkGet(listingIds) : [];
  const liveListingIds = new Set(
    listings.filter((l) => l && !l.deletedAt).map((l) => l.id)
  );
  const liveSceneIds = new Set(
    annotations
      .filter((a) => !a.listingId || liveListingIds.has(a.listingId))
      .map((a) => a.scene3d.sceneId)
  );

  let count = 0;
  for (const sceneId of sceneIds) {
    if (liveSceneIds.has(sceneId) || isPendingScene3d(sceneId)) continue;
    await deleteScene3dAssetsService(sceneId);
    count += 1;
  }
  return count;
}
