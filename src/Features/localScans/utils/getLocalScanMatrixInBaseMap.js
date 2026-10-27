import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "../../baseMaps/js/getBaseMapTransform.js";

// World matrix of a base map group posed by `pose` ({position, angleDeg,
// orientation}, no scale: meterByPx only sizes the plane).
export function getBaseMapGroupMatrix(pose) {
  const euler = getBaseMapEuler(pose);
  const position = pose.position ?? { x: 0, y: 0, z: 0 };
  return new Matrix4().compose(
    new Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0),
    new Quaternion().setFromEuler(
      new Euler(euler.x, euler.y, euler.z, BASE_MAP_ROTATION_ORDER)
    ),
    new Vector3(1, 1, 1)
  );
}

// Pose of a scan root in the frame of a base map group posed by `pose`.
// Stored as baseMap.localScan.matrix, it keeps the scan glued to the base
// map whatever the later moves of the map. → number[16]
export default function getLocalScanMatrixInBaseMap(rootMatrixWorld, pose) {
  return getBaseMapGroupMatrix(pose)
    .invert()
    .multiply(rootMatrixWorld)
    .toArray();
}

// World matrix of the scan glued to a base map (inverse of the above).
export function getLocalScanWorldMatrix(baseMap) {
  return getBaseMapGroupMatrix(baseMap).multiply(
    new Matrix4().fromArray(baseMap.localScan.matrix)
  );
}
