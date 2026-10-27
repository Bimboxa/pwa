import { Euler, Matrix4, Quaternion, Vector3 } from "three";

// Inverse of applyLocalScanPlacement: the {up, scale, origin, yaw} placement
// of a scan root whose world matrix is `matrix` (e.g. the scan glued to a
// base map, moved with it). `up` is kept from the scan: the base map moves
// only translate it and turn it about world Y. → placement
export default function getLocalScanPlacementFromMatrix(matrix, up = "Z") {
  const position = new Vector3(),
    quaternion = new Quaternion(),
    scale = new Vector3();
  new Matrix4().copy(matrix).decompose(position, quaternion, scale);
  const tilt = new Quaternion().setFromEuler(
    new Euler(up === "Z" ? -Math.PI / 2 : 0, 0, 0)
  );
  const yawQuaternion = quaternion.clone().multiply(tilt.invert());
  const yaw = new Euler().setFromQuaternion(yawQuaternion, "YXZ").y;
  const s = scale.x;
  const origin = position
    .applyQuaternion(quaternion.clone().invert())
    .multiplyScalar(-1 / s);
  return {
    up,
    scale: s,
    origin: origin.toArray(),
    yaw: (yaw * 180) / Math.PI,
  };
}
