import { Matrix4, Object3D, Vector3 } from "three";

import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "Features/baseMaps/js/getBaseMapTransform";

import sampleScene3dHeightMap from "./sampleScene3dHeightMap";
import { zoneLocalToScan } from "./scene3dZoneTransform";

// Ground under a world (x, z) on a scan base map, for the first-person walk
// mode: the height map of the scan ("Z max seen from above", see
// rasterizeScene3dHeightMap) gives the relief above the base map plane.
//
// World → base-map-local frame (the zone frame: image centre, +X right, +Y
// up, plane at zone.zMin) → scan frame → height map cell. The world → local
// matrix is built once (the plane pose does not change mid-walk).
//
// transform: getBaseMapTransform(baseMap); planeY: world Y of the plane
// (live group value preferred by the caller); getHeightMap: () → height map
// or null while it loads (scene3dHeightMapStore).
// → (x, z) → world ground Y, or null (no height map yet, outside the zone,
//   empty cell) — the caller then falls back to the plane.
export default function createScene3dGroundSampler({
  baseMap,
  transform,
  planeY,
  getHeightMap,
}) {
  const scene3d = baseMap?.scene3d;
  const zone = scene3d?.zone;
  if (!zone?.center || !transform) return null;
  const zMin = zone.zMin ?? scene3d.bbox?.min?.[2] ?? 0;
  const halfW = (zone.width ?? Infinity) / 2;
  const halfH = (zone.height ?? Infinity) / 2;

  const frame = new Object3D();
  const euler = getBaseMapEuler(transform);
  frame.rotation.order = BASE_MAP_ROTATION_ORDER;
  frame.rotation.set(euler.x, euler.y, euler.z);
  frame.position.set(transform.position.x, planeY, transform.position.z);
  frame.updateMatrixWorld(true);
  const worldToLocal = new Matrix4().copy(frame.matrixWorld).invert();
  const local = new Vector3();

  return function sampleGroundY(x, z) {
    const heightMap = getHeightMap?.();
    if (!heightMap) return null;
    local.set(x, planeY, z).applyMatrix4(worldToLocal);
    if (Math.abs(local.x) > halfW || Math.abs(local.y) > halfH) return null;
    const [sx, sy] = zoneLocalToScan(zone, [local.x, local.y]);
    const scanZ = sampleScene3dHeightMap(heightMap, sx, sy);
    if (scanZ === null) return null;
    return planeY + (scanZ - zMin);
  };
}
