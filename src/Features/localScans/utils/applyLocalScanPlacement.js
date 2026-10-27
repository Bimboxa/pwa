// The source point chosen as origin remains anchored when scale/up changes.
export default function applyLocalScanPlacement(root, placement) {
  root.rotation.set(
    placement.up === "Z" ? -Math.PI / 2 : 0,
    ((placement.yaw ?? 0) * Math.PI) / 180,
    0,
    "YXZ"
  );
  root.scale.setScalar(placement.scale);
  root.position
    .fromArray(placement.origin ?? [0, 0, 0])
    .applyQuaternion(root.quaternion)
    .multiplyScalar(-placement.scale);
  root.updateMatrixWorld(true);
}
