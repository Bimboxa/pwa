import db from "App/db/db";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import localScanRuntime from "Features/localScans/services/localScanRuntime";
import {
  getLocalScanViews,
  isLocalScanViewDisplayed,
} from "Features/localScans/services/localScanViewRegistry";
import { getLocalScanWorldMatrix } from "Features/localScans/utils/getLocalScanMatrixInBaseMap";
import isLocalScanResource from "Features/localScans/utils/isLocalScanResource";

// Point clouds to cut: the ones displayed in the 3D scene (what the user
// sees cut), or — nothing displayed (« Affichage 3D : Masqué ») — the scans
// of the project's scan base maps, decoded through the shared runtime.
// → { clouds: [{data, matrixWorld}], release }
export default async function collectSectionCloudsService(projectId) {
  const scene = getActiveThreedEditor()?.sceneManager?.scene;
  const displayed = getLocalScanViews()
    .filter(
      (view) => view.data?.positions && isLocalScanViewDisplayed(view, scene)
    )
    .map((view) => {
      view.root.updateWorldMatrix(true, false);
      return { data: view.data, matrixWorld: view.root.matrixWorld.clone() };
    });
  if (displayed.length) return { clouds: displayed, release: () => {} };

  const baseMaps = await db.baseMaps
    .where("projectId")
    .equals(projectId)
    .toArray();
  // one base map per scan resource: they all carry the same cloud
  const carrierByResourceId = new Map();
  baseMaps.forEach((baseMap) => {
    const resourceId = baseMap.localScan?.resourceId;
    if (!resourceId || baseMap.deletedAt || !baseMap.localScan.matrix) return;
    if (!carrierByResourceId.has(resourceId))
      carrierByResourceId.set(resourceId, baseMap);
  });
  const handles = [];
  const clouds = [];
  for (const [resourceId, carrier] of carrierByResourceId) {
    const resource = await db.resources.get(resourceId);
    if (!isLocalScanResource(resource)) continue;
    const handle = localScanRuntime.acquire(resource);
    handles.push(handle);
    try {
      const { data } = await handle.promise;
      clouds.push({ data, matrixWorld: getLocalScanWorldMatrix(carrier) });
    } catch (error) {
      // file missing on this device: this scan is skipped
      console.warn("[baseMapClipping] scan not available", error);
    }
  }
  return { clouds, release: () => handles.forEach((h) => h.release()) };
}
