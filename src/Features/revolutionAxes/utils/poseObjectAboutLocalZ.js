// Rigid rotation of an Object3D (an annotation root or a helper group, both
// children of a base map group with their geometry baked at absolute
// base-map-local coordinates) by `phi` radians about the local +Z axis
// through `center` ({ x, y } in base-map-local metres):
//   position = center − Rz(phi)·center,  rotation.z = phi
// Used as the live preview of the cut-axis rotation (the circle's half-view
// split and the handles turn with the diameter). phi = 0 restores identity.
export default function poseObjectAboutLocalZ(object, center, phi) {
  if (!object) return;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  object.rotation.set(0, 0, phi);
  object.position.set(
    center.x - (center.x * cos - center.y * sin),
    center.y - (center.x * sin + center.y * cos),
    0
  );
  object.updateMatrixWorld(true);
}
