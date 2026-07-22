import store from "App/store";

import applyPovSceneStateService from "./applyPovSceneStateService";
import getPov3dCameraTarget from "../utils/getPov3dCameraTarget";
import getEffective3dCameraPose from "../utils/getEffective3dCameraPose";
import getPovFlightPose, { easeInOutCubic } from "../utils/getPovFlightPose";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Camera is applied once the target editor has settled: switching the main
// baseMap makes MainMapEditorV3 reset its camera (EFFECT_RESET_CAMERA) on the
// next render, and a version activation can reload textures in 3D. Double rAF
// covers the render pass; the late re-apply covers slower settling.
const CAMERA_REAPPLY_DELAY_MS = 500;

// "Appliquer la vue" flies the camera to the saved pose instead of cutting to
// it: long enough to read where the view comes from, short enough not to drag.
const CAMERA_FLIGHT_MS = 800;

// Guards the deferred camera callbacks: clicking POV B while POV A's late
// re-apply is still pending must cancel A's callback, not snap back to A.
let _restoreGeneration = 0;

// Single in-flight camera animation (see runFlight). `_flightCleanup` restores
// whatever the flight clobbered — it must run on completion AND on cancel.
let _flightRafId = null;
let _flightCleanup = null;

function endFlight() {
  _flightRafId = null;
  const cleanup = _flightCleanup;
  _flightCleanup = null;
  cleanup?.();
}

function cancelCameraFlight() {
  if (_flightRafId !== null) cancelAnimationFrame(_flightRafId);
  endFlight();
}

// rAF loop feeding `onTick` the EASED progress in [0,1], ending exactly on 1.
// A newer restore (generation bump) aborts it mid-air.
function runFlight({
  generation,
  durationMs = CAMERA_FLIGHT_MS,
  onTick,
  cleanup,
}) {
  cancelCameraFlight();
  _flightCleanup = cleanup ?? null;

  const startedAt = performance.now();
  const tick = (now) => {
    if (generation !== _restoreGeneration) {
      endFlight(); // superseded by a newer restore
      return;
    }
    const t = Math.min(1, (now - startedAt) / durationMs);
    onTick(easeInOutCubic(t));
    if (t < 1) {
      _flightRafId = requestAnimationFrame(tick);
      return;
    }
    endFlight();
  };

  _flightRafId = requestAnimationFrame(tick);
}

// --- 2D ---------------------------------------------------------------

// Target camera matrix: fit the stored image-px footprint into the current
// capture rect. The rect aspect ratio is fixed per format, so fitting the
// width fits the height.
function getCamera2dTarget({ camera2d, aspectRatio }) {
  const footprint = camera2d?.footprint;
  const mapEditor = getActiveMapEditor();
  const viewport = mapEditor?.getViewportSize?.();
  const basePose = store.getState().mapEditor.baseMapPoseInBg;
  if (!footprint?.width || !viewport?.width || !basePose?.k || !mapEditor)
    return null;

  const rect = getCaptureRectBounds(
    viewport.width,
    viewport.height,
    aspectRatio
  );
  if (!rect.width) return null;

  const k = rect.width / (footprint.width * basePose.k);
  const x =
    rect.left + rect.width / 2 - (basePose.x + basePose.k * footprint.cx) * k;
  const y =
    rect.top + rect.height / 2 - (basePose.y + basePose.k * footprint.cy) * k;

  return { matrix: { x, y, k }, rect };
}

function applyCamera2d({ camera2d, aspectRatio }) {
  const target = getCamera2dTarget({ camera2d, aspectRatio });
  if (!target) return;
  getActiveMapEditor()?.setCameraMatrix?.(target.matrix);
}

// Zoom-aware flight: the scale eases geometrically (log-lerp, constant
// perceived zoom speed) and the IMAGE POINT displayed at the frame center is
// lerped — so the move reads as a travelling toward the saved framing rather
// than a pan followed by a zoom.
function flyCamera2d({ camera2d, aspectRatio, generation }) {
  const mapEditor = getActiveMapEditor();
  const target = getCamera2dTarget({ camera2d, aspectRatio });
  const from = mapEditor?.getCameraMatrix?.();
  if (!target || !(from?.k > 0)) {
    applyCamera2d({ camera2d, aspectRatio });
    return;
  }

  const to = target.matrix;
  const cx = target.rect.left + target.rect.width / 2;
  const cy = target.rect.top + target.rect.height / 2;
  // World (bg) point currently at the frame center, and the one that must end
  // up there.
  const w0 = { x: (cx - from.x) / from.k, y: (cy - from.y) / from.k };
  const w1 = { x: (cx - to.x) / to.k, y: (cy - to.y) / to.k };
  const logK0 = Math.log(from.k);
  const logK1 = Math.log(to.k);

  runFlight({
    generation,
    onTick: (s) => {
      const k = Math.exp(logK0 + (logK1 - logK0) * s);
      const wx = w0.x + (w1.x - w0.x) * s;
      const wy = w0.y + (w1.y - w0.y) * s;
      mapEditor.setCameraMatrix?.({ x: cx - k * wx, y: cy - k * wy, k });
    },
  });
}

// --- 3D ---------------------------------------------------------------

function applyCamera3d({ camera3d, aspectRatio }) {
  const controlsManager =
    getActiveThreedEditor()?.sceneManager?.controlsManager;
  if (!controlsManager) return;

  const pose = getPov3dCameraTarget({ camera3d, aspectRatio });
  if (!pose) return;

  controlsManager.applyPoseAndAnimateFov({
    position: pose.position,
    target: pose.target,
    fovFrom: pose.fovDeg,
    fovTo: pose.fovDeg,
    durationMs: 0,
  });
}

// Orbit-aware flight (same interpolation as the video fly-through): the target
// is lerped, the camera offset moves in spherical coords so the camera arcs
// around the scene instead of diving through it.
function flyCamera3d({ camera3d, aspectRatio, generation }) {
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const camera = sceneManager?.camera;
  const controls = sceneManager?.controlsManager?.cameraControls;

  const to = getPov3dCameraTarget({ camera3d, aspectRatio });
  const from = getEffective3dCameraPose({ camera, controls });
  if (!to || !from) {
    applyCamera3d({ camera3d, aspectRatio });
    return;
  }

  // Same reset as ControlsManager.applyPoseAndAnimateFov: a stale focal offset
  // (orbit-around-cursor) would shift every interpolated pose. `from` is
  // already the effective pose, so zeroing it leaves the view put at t = 0.
  controls.setFocalOffset(0, 0, 0, false);

  const prevEnabled = controls.enabled;
  const prevMaxDistance = controls.maxDistance;
  controls.enabled = false; // ignore user input mid-flight
  controls.maxDistance = Infinity; // a far saved pose must not be clamped

  runFlight({
    generation,
    onTick: (s) => {
      // easing already applied by runFlight
      const pose = getPovFlightPose(from, to, s, false);
      camera.fov = pose.fovDeg;
      camera.updateProjectionMatrix();
      // ControlsManager's loop calls update() every frame and re-renders on
      // change, so writing the pose here is enough.
      controls.setLookAt(
        pose.position.x,
        pose.position.y,
        pose.position.z,
        pose.target.x,
        pose.target.y,
        pose.target.z,
        false // no camera-controls transition: we drive the interpolation
      );
    },
    cleanup: () => {
      controls.enabled = prevEnabled;
      controls.maxDistance = prevMaxDistance;
    },
  });
}

// Restores the whole saved view of a POV: displayed 2D/3D editor, frame
// aspect ratio + legend, template visibility, baseMaps + active versions
// (applyPovSceneStateService), and camera (deferred, see below).
//
// `animate`: "Appliquer la vue" flies the camera from the displayed view to
// the saved one instead of cutting.
export default async function restorePovViewService({
  pov,
  dispatch,
  animate = false,
}) {
  if (!pov) return;

  const generation = ++_restoreGeneration;
  cancelCameraFlight(); // a pending flight belongs to a superseded restore

  const stateBefore = store.getState();
  const previousViewerMode = stateBefore.pov.viewerMode;
  const previousBaseMapId = stateBefore.mapEditor.selectedBaseMapId;

  const { skipped, viewerMode, mainBaseMapId, mainBaseMapExists } =
    await applyPovSceneStateService({ pov, dispatch });
  // Keep the selection, skip the view restore (e.g. no 3D editor available).
  if (skipped) return;

  // A flight only means something when it starts from the view on screen:
  // switching editor (2D <-> 3D) or main baseMap re-frames everything, so
  // those land on the saved pose directly.
  const sameEditor = previousViewerMode === viewerMode;
  const sameScene =
    viewerMode === "THREED" ||
    !mainBaseMapId ||
    mainBaseMapId === previousBaseMapId;
  const flying = animate && sameEditor && sameScene;

  const applyCamera = () => {
    if (generation !== _restoreGeneration) return; // superseded by a newer restore
    const aspectRatio = pov.aspectRatio;
    if (viewerMode === "MAP") {
      if (!mainBaseMapId || mainBaseMapExists) {
        if (flying) {
          flyCamera2d({ camera2d: pov.camera2d, aspectRatio, generation });
        } else {
          applyCamera2d({ camera2d: pov.camera2d, aspectRatio });
        }
      }
    } else if (flying) {
      flyCamera3d({ camera3d: pov.camera3d, aspectRatio, generation });
    } else {
      applyCamera3d({ camera3d: pov.camera3d, aspectRatio });
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(applyCamera));
  // A flight owns the camera for its whole duration and lands exactly on the
  // pose: re-applying mid-air would cut it short.
  if (!flying) setTimeout(applyCamera, CAMERA_REAPPLY_DELAY_MS);
}
