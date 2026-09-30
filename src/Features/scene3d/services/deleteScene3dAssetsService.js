import db from "App/db/db";

import { evictScene3dAssets } from "./scene3dAssetsCache";
import { evictScene3dPickData } from "./scene3dPickStore";

// Hard-deletes the local heavy data of one scan (db.scene3dAssets is neither
// soft-deleted nor undoable) and frees its GPU resources and picking data.
export default async function deleteScene3dAssetsService(sceneId) {
  if (!sceneId) return;
  evictScene3dAssets(sceneId);
  evictScene3dPickData(sceneId);
  await db.scene3dAssets.where("sceneId").equals(sceneId).delete();
}
