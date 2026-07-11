import { setSelectedViewerKey } from "Features/viewers/viewersSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";

import {
  getCameraSyncContext,
  computeThreedPoseFrom2d,
  computeTopDownPivotFrom3d,
  computeTwodCameraMatrixFromTopDown,
  computeOrthoFov,
  metersPerScreenPxFrom2d,
  metersPerScreenPxFrom3d,
  TOP_DOWN_POLAR_EPSILON,
} from "../utils/viewerCameraSync";

// Orchestrates the seamless 2D <-> 3D switch: position the hidden viewer's
// camera (both viewers stay mounted, see SectionViewer) so the baseMap image
// keeps the same on-screen place/size, then toggle `selectedViewerKey`.
//
// Both directions add a flat <-> perspective illusion via a fov dolly-zoom
// (narrow fov + far camera ~ orthographic; the target-plane scale is kept
// constant while the fov eases to/from the reference value):
// - 2D->3D: switch on a near-ortho top-down pose, then ease fov up — the
//   flat view progressively gains perspective.
// - 3D->2D: rotate to top-down, ease fov down to near-ortho, then switch.
//
// Every failure path still dispatches the toggle (finally), so the switch
// degrades to the previous plain behavior instead of blocking.

const FOV_ANIMATION_MS = 500;
// Farthest the near-ortho pose may sit (stay inside the camera far plane).
const ORTHO_MAX_DISTANCE_M = 800;

// Diagnostic probes: when enabled, each one logs what is ACTUALLY at the
// canvas center (stored px + scale) plus the on-screen rects of both viewers,
// so any camera mismatch can be localized from the console.
const DEBUG_SWITCH = false;

function roundRect(rect) {
  if (!rect) return null;
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function probe3d(label, s) {
  if (!DEBUG_SWITCH) return;
  try {
    s.controlsManager.syncCameraNow();
    const dom = getActiveThreedEditor()?.sceneManager?.renderer?.domElement;
    const p = computeTopDownPivotFrom3d({ camera: s.camera, ctx: s.ctx });
    const fovEff = s.camera.getEffectiveFOV?.() ?? s.camera.fov;
    const m3 =
      p &&
      metersPerScreenPxFrom3d({
        distance: p.distance,
        fovDeg: fovEff,
        viewportHeight: dom?.clientHeight || s.viewport3d.height,
      });
    console.log(
      `[viewerSwitchDebug] ${label}`,
      JSON.stringify({
        centerStoredPx: p && {
          x: +p.storedPx.x.toFixed(2),
          y: +p.storedPx.y.toFixed(2),
        },
        distance: p && +p.distance.toFixed(3),
        metersPerScreenPx: m3 && +m3.toFixed(6),
        camFov: +s.camera.fov.toFixed(3),
        camZoom: s.camera.zoom,
        camAspect: +s.camera.aspect.toFixed(4),
        controlsDistance: +(
          s.controlsManager.cameraControls?.distance ?? NaN
        ).toFixed(3),
        polar: +(s.controlsManager.cameraControls?.polarAngle ?? NaN).toFixed(
          5
        ),
        azimuth: +(
          s.controlsManager.cameraControls?.azimuthAngle ?? NaN
        ).toFixed(5),
        canvasClient: dom && { w: dom.clientWidth, h: dom.clientHeight },
        canvasRect: roundRect(dom?.getBoundingClientRect?.()),
        svgRect: roundRect(s.mapEditor.getViewportRect?.()),
        viewport3dAtStart: s.viewport3d,
        viewport2dAtStart: s.viewport2d,
      })
    );
  } catch (e) {
    console.log(`[viewerSwitchDebug] ${label} probe failed`, e);
  }
}

function probe2d(label, { cameraMatrix, basePose, s }) {
  if (!DEBUG_SWITCH || !cameraMatrix) return;
  const px =
    ((s.viewport2d.width / 2 - cameraMatrix.x) / cameraMatrix.k - basePose.x) /
    basePose.k;
  const py =
    ((s.viewport2d.height / 2 - cameraMatrix.y) / cameraMatrix.k - basePose.y) /
    basePose.k;
  console.log(
    `[viewerSwitchDebug] ${label}`,
    JSON.stringify({
      centerStoredPx: { x: +px.toFixed(2), y: +py.toFixed(2) },
      metersPerScreenPx: +metersPerScreenPxFrom2d({
        cameraMatrix,
        basePose,
        ctx: s.ctx,
      }).toFixed(6),
      cameraMatrix: {
        x: +cameraMatrix.x.toFixed(2),
        y: +cameraMatrix.y.toFixed(2),
        k: +cameraMatrix.k.toFixed(5),
      },
      basePose,
      svgRect: roundRect(s.mapEditor.getViewportRect?.()),
      viewport2d: s.mapEditor.getViewportSize?.(),
    })
  );
}

let isSwitching = false;

function getViewersState({ baseMap, basePose }) {
  const threedEditor = getActiveThreedEditor();
  const mapEditor = getActiveMapEditor();
  const camera = threedEditor?.sceneManager?.camera;
  const dom = threedEditor?.sceneManager?.renderer?.domElement;
  const controlsManager = threedEditor?.sceneManager?.controlsManager;
  if (!camera || !dom || !controlsManager?.cameraControls || !mapEditor) {
    return null;
  }

  const ctx = getCameraSyncContext({ baseMap, basePose });
  if (!ctx) return null;

  // A layout change (startup overlay collapsing, panel toggling) can leave
  // the 3D canvas with a stale fixed size until the next window resize —
  // re-sync it BEFORE measuring, or the camera match is computed against a
  // canvas that doesn't fill the panel.
  threedEditor.sceneManager?.ensureSizeSynced?.();

  const viewport2d = mapEditor.getViewportSize?.();
  const viewport3d = { width: dom.clientWidth, height: dom.clientHeight };
  if (!(viewport2d?.width > 0) || !(viewport2d?.height > 0)) return null;
  if (!(viewport3d.width > 0) || !(viewport3d.height > 0)) return null;

  // Stable reference fov: the live camera.fov may still hold a transition
  // value (e.g. a pending post-switch restore).
  const fovDeg =
    controlsManager.referenceFov ?? camera.getEffectiveFOV?.() ?? camera.fov;

  return {
    mapEditor,
    controlsManager,
    camera,
    ctx,
    viewport2d,
    viewport3d,
    fovDeg,
  };
}

export async function switchMapToThreed({ dispatch, baseMap, basePose }) {
  if (isSwitching) return;
  isSwitching = true;
  try {
    let animation = null;
    try {
      const s = getViewersState({ baseMap, basePose });
      if (!s) return;

      const cameraMatrix = s.mapEditor.getCameraMatrix?.();
      const orthoFov = computeOrthoFov({
        metersPerScreenPx: metersPerScreenPxFrom2d({
          cameraMatrix,
          basePose,
          ctx: s.ctx,
        }),
        viewportHeight: s.viewport3d.height,
        maxDistanceM: ORTHO_MAX_DISTANCE_M,
      });

      const pose = computeThreedPoseFrom2d({
        cameraMatrix,
        viewport2d: s.viewport2d,
        viewport3d: s.viewport3d,
        basePose,
        ctx: s.ctx,
        fovDeg: orthoFov,
        maxDistance: ORTHO_MAX_DISTANCE_M,
      });
      if (pose) {
        probe2d("2D->3D | source 2D view", { cameraMatrix, basePose, s });
        // The near-ortho start pose is applied synchronously (before the
        // dispatch below reveals the 3D panel); the fov ease then plays
        // while the viewer is visible.
        animation = s.controlsManager.applyPoseAndAnimateFov({
          position: pose.position,
          target: pose.target,
          fovFrom: orthoFov,
          fovTo: s.fovDeg,
          durationMs: FOV_ANIMATION_MS,
        });
        probe3d("2D->3D | 3D start pose (near-ortho)", s);
        animation = animation?.then?.(() => probe3d("2D->3D | 3D end pose", s));
      }
    } catch (e) {
      console.log("[viewerSwitch] 2D->3D camera sync failed", e);
    } finally {
      dispatch(setSelectedViewerKey("THREED"));
    }

    if (animation) {
      try {
        await animation;
      } catch (e) {
        console.log("[viewerSwitch] 2D->3D fov animation failed", e);
      }
    }
  } finally {
    isSwitching = false;
  }
}

export async function switchThreedToMap({ dispatch, baseMap, basePose }) {
  if (isSwitching) return;
  isSwitching = true;
  let s = null;
  let fovRef = null;
  try {
    s = getViewersState({ baseMap, basePose });
    if (!s) return;
    fovRef = s.fovDeg;

    const pivot = computeTopDownPivotFrom3d({ camera: s.camera, ctx: s.ctx });
    if (!pivot) return;
    probe3d("3D->2D | 3D before rotate", s);

    await s.controlsManager.animateToTopDown({
      target: pivot.target,
      azimuthRad: s.ctx.alphaRad,
      polarRad: TOP_DOWN_POLAR_EPSILON,
    });
    probe3d("3D->2D | 3D after rotate", s);

    // Flatten the perspective toward ortho, keeping the plan scale constant.
    const settledDistance =
      s.controlsManager.cameraControls?.distance ?? pivot.distance;
    const orthoFov = computeOrthoFov({
      metersPerScreenPx: metersPerScreenPxFrom3d({
        distance: settledDistance,
        fovDeg: fovRef,
        viewportHeight: s.viewport3d.height,
      }),
      viewportHeight: s.viewport3d.height,
      maxDistanceM: ORTHO_MAX_DISTANCE_M,
    });
    await s.controlsManager.animateFovTo({
      fovTo: orthoFov,
      durationMs: FOV_ANIMATION_MS,
    });

    // Compute the 2D matrix from the camera state ACTUALLY settled at the end
    // of the animations (not from the pre-animation pivot): sync the camera
    // object now and re-derive the screen-center point and distance from it,
    // so the 2D view matches the last rendered 3D frame even if a transition
    // left a small residual.
    s.controlsManager.syncCameraNow();
    const settledPivot =
      computeTopDownPivotFrom3d({ camera: s.camera, ctx: s.ctx }) ?? pivot;
    const fovNow = s.camera.getEffectiveFOV?.() ?? s.camera.fov;

    const cameraMatrix = computeTwodCameraMatrixFromTopDown({
      storedPx: settledPivot.storedPx,
      distance: settledPivot.distance,
      viewport2d: s.viewport2d,
      viewport3d: s.viewport3d,
      basePose,
      ctx: s.ctx,
      fovDeg: fovNow,
    });
    probe3d("3D->2D | 3D after flatten (last visible frame)", s);
    probe2d("3D->2D | target 2D view", { cameraMatrix, basePose, s });
    if (cameraMatrix) s.mapEditor.setCameraMatrix?.(cameraMatrix);
  } catch (e) {
    console.log("[viewerSwitch] 3D->2D camera sync failed", e);
  } finally {
    isSwitching = false;
    dispatch(setSelectedViewerKey("MAP"));
    // Put the (soon hidden) 3D camera back on the reference perspective so
    // other 3D flows keep their usual fov and dolly limits. Deferred past the
    // panel swap paint: restoring synchronously would let the render loop
    // show the restored camera one frame before the 3D panel disappears.
    if (s && fovRef) {
      const controlsManager = s.controlsManager;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (isSwitching) return; // a new switch owns the camera again
          controlsManager.restorePerspectiveFov({ fovDeg: fovRef });
        })
      );
    }
  }
}
