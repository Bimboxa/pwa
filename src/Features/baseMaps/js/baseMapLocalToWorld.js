import { Object3D, Vector3 } from "three";

import { BASE_MAP_ROTATION_ORDER, getBaseMapEuler } from "./getBaseMapTransform";

// Project a 2D point expressed in basemap-local metres (the frame
// `pixelToWorld` outputs) into the 3D world frame, applying the basemap's
// 3D placement (orientation + angleDeg + position).
//
// `localPoint` is `{x, y}` (in metres, basemap plane). `transform` is the
// shape returned by `getBaseMapTransform(baseMap)`.
//
// Returns a `THREE.Vector3` in world coords.
export default function baseMapLocalToWorld(localPoint, transform) {
  const tmp = new Object3D();
  const euler = getBaseMapEuler(transform);
  tmp.rotation.order = BASE_MAP_ROTATION_ORDER;
  tmp.rotation.set(euler.x, euler.y, euler.z);
  tmp.position.set(transform.position.x, transform.position.y, transform.position.z);
  tmp.updateMatrixWorld(true);
  return tmp.localToWorld(new Vector3(localPoint.x, localPoint.y, 0));
}
