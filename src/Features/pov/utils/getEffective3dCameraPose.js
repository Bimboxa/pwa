import * as THREE from "three";

// The pose the 3D camera ACTUALLY shows, as {position, target, fovDeg} with
// the target on the look axis.
//
// `controls.getTarget()` returns the ORBIT point, which the
// orbit-around-cursor gesture (ControlsManager.setOrbitPoint) moves off the
// look axis through camera-controls' focal offset. Feeding that point back to
// `setLookAt` — which carries no offset — would swing the camera toward it.
// Rebuilding the target on the look axis, at the same distance, makes
// `setLookAt` reproduce the displayed view exactly.
//
// Shared by the POV snapshot (what gets saved) and the camera flight (where
// the flight starts from), so both speak of the same pose.
export default function getEffective3dCameraPose({ camera, controls }) {
  if (!camera || !controls) return null;

  const orbitTarget = controls.getTarget(new THREE.Vector3());
  const distance = camera.position.distanceTo(orbitTarget) || 1;
  camera.updateMatrixWorld();
  const target = camera
    .getWorldDirection(new THREE.Vector3())
    .multiplyScalar(distance)
    .add(camera.position);

  return {
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    target: { x: target.x, y: target.y, z: target.z },
    fovDeg: camera.getEffectiveFOV?.() ?? camera.fov,
  };
}
