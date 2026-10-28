// Key of the height map of a scan base map (local point cloud) in
// db.scene3dAssets: one HEIGHT row per BASE MAP (the map is built in the
// base map frame, see getLocalScanHeightFrame), under a scene id derived
// from the base map id. Pure module (shared with the scene3d services).
const PREFIX = "localScan:";

export function getLocalScanHeightSceneId(baseMapId) {
  return `${PREFIX}${baseMapId}`;
}

export function isLocalScanHeightSceneId(sceneId) {
  return String(sceneId).startsWith(PREFIX);
}
