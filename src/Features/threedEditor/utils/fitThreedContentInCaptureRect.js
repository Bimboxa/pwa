import { Box3, Vector3 } from "three";

import { getActiveThreedEditor } from "../services/threedEditorRegistry";
import getEffective3dCameraPose from "Features/pov/utils/getEffective3dCameraPose";

// Capture tool: move the 3D camera POSITION ONLY (dolly along the view axis
// + lateral truck, orientation untouched) so the scene content fills the
// capture rect. `rect` and `hostBounds` come from useCaptureFrameBounds:
// the rect is a plain crop of the canvas, so it subtends the (rect / host)
// fraction of the camera frustum.
export default async function fitThreedContentInCaptureRect({
  rect,
  hostBounds,
}) {
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const camera = sceneManager?.camera;
  const controls = sceneManager?.controlsManager?.cameraControls;
  if (
    !camera ||
    !controls ||
    !rect?.width ||
    !rect?.height ||
    !hostBounds?.width ||
    !hostBounds?.height
  )
    return;

  // Scene bbox: baseMap planes + annotation meshes, restricted to what is
  // effectively rendered. Box3.setFromObject ignores `visible`, and a hidden
  // baseMap image keeps its (huge) plane in the group — only the meshWrap
  // child is toggled invisible — so we walk the trees ourselves, pruning
  // invisible branches. Sprites (constant-screen-size labels) and degenerate
  // point boxes (0-scaled planes of unpositioned baseMaps) are skipped.
  const box = new Box3();
  box.makeEmpty();
  const objBox = new Box3();
  const objSize = new Vector3();
  let hasAny = false;
  const expandVisible = (obj) => {
    if (!obj || obj.visible === false) return;
    if ((obj.isMesh || obj.isLine) && !obj.isSprite && obj.geometry) {
      const geom = obj.geometry;
      if (!geom.boundingBox) geom.computeBoundingBox();
      if (geom.boundingBox && !geom.boundingBox.isEmpty()) {
        objBox.copy(geom.boundingBox).applyMatrix4(obj.matrixWorld);
        objBox.getSize(objSize);
        const isPoint = objSize.x === 0 && objSize.y === 0 && objSize.z === 0;
        if (isFinite(objBox.min.x) && !isPoint) {
          box.union(objBox);
          hasAny = true;
        }
      }
    }
    obj.children.forEach(expandVisible);
  };
  Object.values(sceneManager.imagesManager?.imagesMap || {}).forEach(
    expandVisible
  );
  Object.values(
    sceneManager.annotationsManager?.annotationsObjectsMap || {}
  ).forEach(expandVisible);
  if (!hasAny) return;

  camera.updateMatrixWorld();
  const forward = camera.getWorldDirection(new Vector3());
  const right = new Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 0)
    .normalize();
  const up = new Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 1)
    .normalize();

  // Half extents of the world AABB along the camera axes.
  const center = box.getCenter(new Vector3());
  const half = box.getSize(new Vector3()).multiplyScalar(0.5);
  const extentAlong = (axis) =>
    half.x * Math.abs(axis.x) +
    half.y * Math.abs(axis.y) +
    half.z * Math.abs(axis.z);
  const halfW = extentAlong(right);
  const halfH = extentAlong(up);
  const halfD = extentAlong(forward);

  // Distance from the bbox center so the content fits BOTH rect dimensions,
  // measured at the center's depth plane (+ halfD so the near half of the
  // box does not overflow the frame).
  const fovDeg = camera.getEffectiveFOV?.() ?? camera.fov;
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360); // vertical fov
  const margin = 0.95; // small breathing margin inside the frame
  const distance =
    Math.max(
      halfH / (tanHalf * (rect.height / hostBounds.height) * margin),
      halfW /
        (tanHalf * camera.aspect * (rect.width / hostBounds.width) * margin)
    ) + halfD;

  // Truck so the bbox center projects at the rect center. Zero when the rect
  // is centered in the host (the default: getCaptureRectBounds centers it),
  // kept for robustness.
  const worldPerPx = (2 * distance * tanHalf) / hostBounds.height;
  const ox = (rect.left + rect.width / 2 - hostBounds.width / 2) * worldPerPx;
  const oy = (rect.top + rect.height / 2 - hostBounds.height / 2) * worldPerPx;

  const position = center
    .clone()
    .addScaledVector(forward, -distance)
    .addScaledVector(right, -ox)
    .addScaledVector(up, oy);
  // Target rebuilt on the same look axis: the quaternion is unchanged (pure
  // dolly + truck) and the orbit point lands at the content's depth.
  const target = position.clone().addScaledVector(forward, distance);

  // A stale focal offset (left by orbit-around-cursor) would be re-applied
  // on top of the pose as a lateral shift — zero it first. But zeroing it
  // alone jumps the view (camera-controls' internal position/target do not
  // include the offset): re-assert the EFFECTIVE pose instantly right after,
  // so the displayed view stays put and the animated transition below starts
  // from it continuously (same recipe as restorePovViewService.flyCamera3d).
  const effective = getEffective3dCameraPose({ camera, controls });
  controls.setFocalOffset(0, 0, 0, false);
  if (effective) {
    controls.setLookAt(
      effective.position.x,
      effective.position.y,
      effective.position.z,
      effective.target.x,
      effective.target.y,
      effective.target.z,
      false // instant: this is the pose already on screen
    );
  }
  const prevMaxDistance = controls.maxDistance;
  controls.maxDistance = Infinity;
  try {
    await controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      true // smooth transition
    );
  } finally {
    // Keep the limit lifted when the fitted pose sits beyond it, so the
    // settled pose is not clamped back (mirrors animateFovTo).
    if (controls.distance <= prevMaxDistance) {
      controls.maxDistance = prevMaxDistance;
    }
  }
}
