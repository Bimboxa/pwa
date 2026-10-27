import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "../../baseMaps/js/getBaseMapTransform.js";

// Pose of a scan root in the frame of a base map group posed by `pose`
// ({position, angleDeg, orientation}, no scale: meterByPx only sizes the
// plane). Stored as baseMap.localScan.matrix, it keeps the scan glued to
// the base map whatever the later moves of the map. → number[16]
export default function getLocalScanMatrixInBaseMap(rootMatrixWorld, pose) {
  const euler = getBaseMapEuler(pose);
  const position = pose.position ?? { x: 0, y: 0, z: 0 };
  const group = new Matrix4().compose(
    new Vector3(position.x, position.y, position.z),
    new Quaternion().setFromEuler(
      new Euler(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
    ),
    new Vector3(1, 1, 1)
  );
  return group.invert().multiply(rootMatrixWorld).toArray();
}
