import { Matrix4, Object3D, Vector3 } from "three";

import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "Features/baseMaps/js/getBaseMapTransform";
import sampleScene3dHeightMap from "Features/scene3d/utils/sampleScene3dHeightMap";

// Ground under a world (x, z) on a base map projected from a local point
// cloud, for the first-person walk mode: the height map of the base map
// (localScanHeightMapService — base map group frame: u = image X, w =
// image up, h above the plane) gives the relief the walker stands on.
// Same contract as createScene3dGroundSampler: transform =
// getBaseMapTransform(baseMap), planeY = world Y of the plane, getHeightMap
// → height map or null while it loads.
// → (x, z) → world ground Y, or null (no map yet, outside the image, empty
//   cell) — the caller then falls back to the plane.
export default function createLocalScanGroundSampler({
  transform,
  planeY,
  getHeightMap,
}) {
  if (!transform) return null;
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
    const h = sampleScene3dHeightMap(heightMap, local.x, local.y);
    return h === null ? null : planeY + h;
  };
}
