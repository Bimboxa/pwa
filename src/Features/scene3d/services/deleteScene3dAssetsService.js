import db from "App/db/db";

import { evictScene3dAssets } from "./scene3dAssetsCache";
import { evictScene3dHeightMap } from "./scene3dHeightMapStore";
import { evictScene3dPickData } from "./scene3dPickStore";

// Hard-deletes the local heavy data of one scan (db.scene3dAssets is neither
// soft-deleted nor undoable) and frees its GPU resources, picking data and
// height map.
export default async function deleteScene3dAssetsService(sceneId) {
  if (!sceneId) return;
  evictScene3dAssets(sceneId);
  evictScene3dPickData(sceneId);
  evictScene3dHeightMap(sceneId);
  await db.scene3dAssets.where("sceneId").equals(sceneId).delete();
}
