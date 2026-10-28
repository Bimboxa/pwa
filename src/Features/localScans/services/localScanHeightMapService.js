import db from "App/db/db";

import { getScene3dHeightId } from "Features/scene3d/utils/scene3dAssetIds";
import {
  ensureScene3dHeightMap,
  evictScene3dHeightMap,
  getScene3dHeightMapEntryStatus,
} from "Features/scene3d/services/scene3dHeightMapStore";

import localScanRuntime from "./localScanRuntime";
import { buildLocalScanHeightMapInWorker } from "./projectLocalScanInWorker";
import getLocalScanHeightFrame from "../utils/getLocalScanHeightFrame";
import { getLocalScanWorldMatrix } from "../utils/getLocalScanMatrixInBaseMap";
import { getLocalScanHeightSceneId } from "../utils/localScanHeightSceneId";

// Height map of a scan base map projected from a local point cloud: what
// gives the 2D editor the altitude of the scan under the cursor (same
// store, same grid as the « Scène 3D » meshes — scene3dHeightMapStore,
// db.scene3dAssets HEIGHT row keyed on the base map, see
// localScanHeightSceneId). Built at the creation of the base map and at
// each « Mettre à jour le fond de plan »; rebuilt once for the base maps
// created before, from the shared decoded scan (localScanRuntime).

// Default options of the map (baseMap.createdFrom.heightMap): the points
// below the slice count (the floor), the points above do not (the
// ceiling of an indoor scan would hide everything).
export const DEFAULT_HEIGHT_MAP_OPTIONS = {
  includeBelow: true,
  includeAbove: false,
};

// Height interval (base map frame: above the plane) of the points that
// feed the map, from the slice of the base map image (createdFrom lower /
// upper, world Y) and the options. baseMap: {position, createdFrom}.
// → [hMin, hMax] | null (every point)
export function getLocalScanHeightRange(baseMap, options) {
  const { lower, upper } = baseMap?.createdFrom ?? {};
  const { includeBelow, includeAbove } = {
    ...DEFAULT_HEIGHT_MAP_OPTIONS,
    ...baseMap?.createdFrom?.heightMap,
    ...options,
  };
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  // horizontal base map: local Z = world Y − altitude
  const altitude = baseMap?.position?.y ?? 0;
  return [
    includeBelow ? -Infinity : lower - altitude,
    includeAbove ? Infinity : upper - altitude,
  ];
}

// data: decoded points ({positions, bounds}); rootMatrixWorld: the scan root
// pose (three.js Matrix4); baseMap: {position, angleDeg, orientation,
// refWidth, refHeight, meterByPx, createdFrom} of the base map; options:
// {includeBelow, includeAbove} (default: the stored ones).
export async function buildLocalScanHeightMap({
  baseMapId,
  projectId,
  data,
  rootMatrixWorld,
  baseMap,
  options,
}) {
  const frame = {
    ...getLocalScanHeightFrame(rootMatrixWorld, baseMap, data.bounds),
    range: getLocalScanHeightRange(baseMap, options),
  };
  const heightMap = await buildLocalScanHeightMapInWorker(data, frame);
  const sceneId = getLocalScanHeightSceneId(baseMapId);
  await db.scene3dAssets.put({
    id: getScene3dHeightId(sceneId),
    sceneId,
    projectId: projectId ?? null,
    kind: "HEIGHT",
    ...heightMap,
  });
  // the store reads the new row at the next request
  evictScene3dHeightMap(sceneId);
  return heightMap;
}

// Base maps created before the height maps existed: one rebuild per base
// map and page life, from the resource (full decode through the shared
// runtime). Missing file on this device → no map (MISSING stays).
const rebuilds = new Map();
const failed = new Set();

async function rebuildLocalScanHeightMap(baseMap) {
  const resource = await db.resources.get(baseMap.localScan.resourceId);
  if (!resource || resource.deletedAt)
    throw new Error("Le scan de ce fond de plan n’est plus disponible.");
  const handle = localScanRuntime.acquire(resource);
  try {
    const { data } = await handle.promise;
    const startedAt = Date.now();
    await buildLocalScanHeightMap({
      baseMapId: baseMap.id,
      projectId: baseMap.projectId,
      data,
      rootMatrixWorld: getLocalScanWorldMatrix(baseMap),
      baseMap,
    });
    console.log(
      `[localScans] base map ${baseMap.id}: height map rebuilt in ${Date.now() - startedAt} ms`
    );
  } finally {
    handle.release();
  }
}

// Makes the height map of a scan base map available (no-op when already
// there). baseMap: db record or BaseMap instance carrying `localScan`.
// → "LOADING" | "READY" | "MISSING" | "ERROR"
export function ensureLocalScanHeightMap(baseMap) {
  if (!baseMap?.localScan?.resourceId) return "MISSING";
  const sceneId = getLocalScanHeightSceneId(baseMap.id);
  const status =
    getScene3dHeightMapEntryStatus(sceneId) ??
    ensureScene3dHeightMap(sceneId, { projectId: baseMap.projectId });
  if (status !== "MISSING" || failed.has(sceneId)) return status;
  if (!rebuilds.has(sceneId)) {
    const job = rebuildLocalScanHeightMap(baseMap)
      .then(() => {
        // READY at the next request (the row is stored now)
        evictScene3dHeightMap(sceneId);
        ensureScene3dHeightMap(sceneId, { projectId: baseMap.projectId });
      })
      .catch((error) => {
        console.warn("[localScans] height map rebuild failed", error);
        failed.add(sceneId);
      })
      .finally(() => rebuilds.delete(sceneId));
    rebuilds.set(sceneId, job);
  }
  return "LOADING";
}

// Status of the height map of a scan base map, as ensureLocalScanHeightMap
// reports it, without starting anything. → status | null
export function getLocalScanHeightMapStatus(baseMap) {
  const sceneId = getLocalScanHeightSceneId(baseMap.id);
  if (rebuilds.has(sceneId)) return "LOADING";
  return getScene3dHeightMapEntryStatus(sceneId);
}
