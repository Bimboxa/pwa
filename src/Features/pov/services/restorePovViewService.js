import store from "App/store";

import applyPovSceneStateService from "./applyPovSceneStateService";
import getPov3dCameraTarget from "../utils/getPov3dCameraTarget";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Camera is applied once the target editor has settled: switching the main
// baseMap makes MainMapEditorV3 reset its camera (EFFECT_RESET_CAMERA) on the
// next render, and a version activation can reload textures in 3D. Double rAF
// covers the render pass; the late re-apply covers slower settling.
const CAMERA_REAPPLY_DELAY_MS = 500;

// Guards the deferred camera callbacks: clicking POV B while POV A's late
// re-apply is still pending must cancel A's callback, not snap back to A.
let _restoreGeneration = 0;

function applyCamera2d({ camera2d, aspectRatio, rightInset }) {
  const footprint = camera2d?.footprint;
  const mapEditor = getActiveMapEditor();
  const viewport = mapEditor?.getViewportSize?.();
  const basePose = store.getState().mapEditor.baseMapPoseInBg;
  if (!footprint?.width || !viewport?.width || !basePose?.k || !mapEditor)
    return;

  const rect = getCaptureRectBounds(
    viewport.width,
    viewport.height,
    aspectRatio,
    { rightInset }
  );
  if (!rect.width) return;

  // Fit the stored image-px footprint into the current capture rect. The rect
  // aspect ratio is fixed per format, so fitting the width fits the height.
  const k = rect.width / (footprint.width * basePose.k);
  const x =
    rect.left + rect.width / 2 - (basePose.x + basePose.k * footprint.cx) * k;
  const y =
    rect.top + rect.height / 2 - (basePose.y + basePose.k * footprint.cy) * k;
  mapEditor.setCameraMatrix?.({ x, y, k });
}

function applyCamera3d({ camera3d, aspectRatio, rightInset }) {
  const controlsManager =
    getActiveThreedEditor()?.sceneManager?.controlsManager;
  if (!controlsManager) return;

  const pose = getPov3dCameraTarget({ camera3d, aspectRatio, rightInset });
  if (!pose) return;

  controlsManager.applyPoseAndAnimateFov({
    position: pose.position,
    target: pose.target,
    fovFrom: pose.fovDeg,
    fovTo: pose.fovDeg,
    durationMs: 0,
  });
}

// Restores the whole saved view of a POV: displayed 2D/3D editor, frame
// aspect ratio + legend, template visibility, baseMaps + active versions
// (applyPovSceneStateService), and camera (deferred, see below).
export default async function restorePovViewService({ pov, dispatch }) {
  if (!pov) return;

  const generation = ++_restoreGeneration;

  const { skipped, viewerMode, mainBaseMapId, mainBaseMapExists } =
    await applyPovSceneStateService({ pov, dispatch });
  // Keep the selection, skip the view restore (e.g. no 3D editor available).
  if (skipped) return;

  // camera — deferred past the render pass, then re-applied once
  const rightInsetNow = () => {
    const s = store.getState();
    return s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0;
  };

  const applyCamera = () => {
    if (generation !== _restoreGeneration) return; // superseded by a newer restore
    const aspectRatio = pov.aspectRatio;
    const rightInset = rightInsetNow();
    if (viewerMode === "MAP") {
      if (!mainBaseMapId || mainBaseMapExists) {
        applyCamera2d({ camera2d: pov.camera2d, aspectRatio, rightInset });
      }
    } else {
      applyCamera3d({ camera3d: pov.camera3d, aspectRatio, rightInset });
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(applyCamera));
  setTimeout(applyCamera, CAMERA_REAPPLY_DELAY_MS);
}
