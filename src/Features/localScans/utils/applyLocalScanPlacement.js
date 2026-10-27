// The source point chosen as origin remains anchored when scale/up changes.
export default function applyLocalScanPlacement(root, placement) {
  root.rotation.x = placement.up === "Z" ? -Math.PI / 2 : 0;
  root.scale.setScalar(placement.scale);
  root.position
    .fromArray(placement.origin ?? [0, 0, 0])
    .applyQuaternion(root.quaternion)
    .multiplyScalar(-placement.scale);
  root.updateMatrixWorld(true);
}
