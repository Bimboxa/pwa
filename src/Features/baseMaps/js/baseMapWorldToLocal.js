import { Object3D, Vector3 } from "three";

import { BASE_MAP_ROTATION_ORDER, getBaseMapEuler } from "./getBaseMapTransform";

// Inverse of `baseMapLocalToWorld`: express a 3D world point in a basemap's
// local metre frame (the frame `pixelToWorld` outputs, with a perpendicular Z).
//
// `worldPoint` is a `{x, y, z}` (or THREE.Vector3) in world coords. `transform`
// is the shape returned by `getBaseMapTransform(baseMap)`.
//
// Returns a `THREE.Vector3` in basemap-local metres (x, y in plane, z normal).
export default function baseMapWorldToLocal(worldPoint, transform) {
  const tmp = new Object3D();
  const euler = getBaseMapEuler(transform);
  tmp.rotation.order = BASE_MAP_ROTATION_ORDER;
  tmp.rotation.set(euler.x, euler.y, euler.z);
  tmp.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z
  );
  tmp.updateMatrixWorld(true);
  return tmp.worldToLocal(
    new Vector3(worldPoint.x, worldPoint.y, worldPoint.z ?? 0)
  );
}
