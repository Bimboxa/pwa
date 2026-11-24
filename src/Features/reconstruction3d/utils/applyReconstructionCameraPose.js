import { MathUtils, Matrix4, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Drives the camera of the 3D editor from a camera of a 3D reconstruction.
//
// A reconstruction camera is expressed in the glTF frame of the model (Y
// up). In the scene, the model hangs under the base map group:
//   group → scanWrap (scale) → pivot (zone rotation) → inner (zone offset)
//     → model root (Rx(+π/2): glTF → scan frame) → gltf.scene
// (attachScene3dGlbToBaseMapGroup / parseScene3dGlb). The glTF → world
// matrix is therefore `inner.matrixWorld × Rx(+π/2)` — read from the live
// scene graph, so a moved / turned / rescaled base map is followed.

const GLTF_TO_SCAN = new Matrix4().makeRotationX(Math.PI / 2);
const DEFAULT_TARGET_DISTANCE = 5;

const matrix = new Matrix4();
const position = new Vector3();
const forward = new Vector3();

function getSceneManager() {
  return getActiveThreedEditor()?.sceneManager ?? null;
}

// glTF frame of the model of the base map → world. null while the model is
// not attached in the 3D editor.
function getModelMatrixWorld(sceneManager, baseMapId, target) {
  const group = sceneManager?.imagesManager?.getGroup?.(baseMapId);
  const inner = group?.userData?.scanWrap?.children?.[0]?.children?.[0];
  if (!inner) return null;
  inner.updateWorldMatrix(true, false);
  return target.multiplyMatrices(inner.matrixWorld, GLTF_TO_SCAN);
}

// The canvas of the 3D editor (user gestures on it hand the camera back).
export function getThreedEditorCanvas() {
  return getSceneManager()?.renderer?.domElement ?? null;
}

// Vertical fov of the 3D perspective camera, degrees (null without editor).
export function getThreedPerspectiveFov() {
  return getSceneManager()?.perspectiveCamera?.fov ?? null;
}

export function setThreedPerspectiveFov(fovDeg) {
  const camera = getSceneManager()?.perspectiveCamera;
  if (!camera || !(fovDeg > 0) || Math.abs(camera.fov - fovDeg) < 1e-3) return;
  camera.fov = fovDeg;
  camera.updateProjectionMatrix();
  getSceneManager()?.requestRender?.();
}

/**
 * Jumps the camera of the 3D editor to a reconstruction camera.
 *
 * @param {Object} params
 * @param {string} params.baseMapId
 * @param {{position: number[], forward: number[], hfovDeg?: number}} params.pose
 *   glTF frame of the model
 * @returns {boolean} false when nothing was applied (no editor, model not
 *   attached yet, orthographic camera)
 */
export default function applyReconstructionCameraPose({ baseMapId, pose }) {
  const sceneManager = getSceneManager();
  const controlsManager = sceneManager?.controlsManager;
  if (!controlsManager?.cameraControls || !pose) return false;
  // a camera position means nothing in orthographic projection
  if (sceneManager.camera?.isOrthographicCamera) return false;
  if (!getModelMatrixWorld(sceneManager, baseMapId, matrix)) return false;

  position.fromArray(pose.position).applyMatrix4(matrix);
  // rotation (and scale) only, renormalized
  forward.fromArray(pose.forward).transformDirection(matrix);
  if (![position.x, position.y, position.z].every(Number.isFinite))
    return false;

  if (pose.hfovDeg > 0) {
    const camera = sceneManager.perspectiveCamera;
    const aspect = camera?.aspect > 0 ? camera.aspect : 1;
    const vfovDeg = MathUtils.radToDeg(
      2 * Math.atan(Math.tan(MathUtils.degToRad(pose.hfovDeg) / 2) / aspect)
    );
    if (camera && Math.abs(camera.fov - vfovDeg) > 1e-3) {
      camera.fov = vfovDeg;
      camera.updateProjectionMatrix();
    }
  }

  // keep the orbit distance: the orbit point stays ahead of the camera when
  // the user takes it back
  const distance = controlsManager.cameraControls.distance;
  const reach =
    Number.isFinite(distance) && distance > 0.05
      ? distance
      : DEFAULT_TARGET_DISTANCE;
  controlsManager.applyPoseInstant({
    position,
    target: {
      x: position.x + forward.x * reach,
      y: position.y + forward.y * reach,
      z: position.z + forward.z * reach,
    },
  });
  return true;
}
