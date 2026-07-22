import { setPovViewerMode } from "../povSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import applyPovSceneStateService from "./applyPovSceneStateService";
import restorePovViewService from "./restorePovViewService";
import getPov3dCameraTarget from "../utils/getPov3dCameraTarget";
import getPovFlightPose from "../utils/getPovFlightPose";
import createMp4Encoder from "../utils/encodeFramesToMp4";

import captureMapAsPng from "Features/mapEditor/utils/captureMapAsPng";
import getCaptureRectBounds, {
  ASPECT_RATIOS,
} from "Features/mapEditor/utils/getCaptureRectBounds";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import downloadBlob from "Features/files/utils/downloadBlob";

// Time left to the scene after a POV state is applied (template visibility
// writes -> React -> mesh rebuilds, baseMap version textures). Frames are
// rendered offline, so waiting here costs nothing in the video timeline.
const SETTLE_MS = 900;

// Cap on the render pixel ratio: the WebGL buffer is (viewport × ratio), a
// large window at ratio 4 would allocate hundreds of MB.
const MAX_EXPORT_PIXEL_RATIO = 3;

const OVERLAY_PIXEL_RATIO = 2;

export class PovVideoCancelled extends Error {
  constructor() {
    super("POV video generation cancelled");
    this.name = "PovVideoCancelled";
  }
}

function nextFrame() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleScene() {
  await nextFrame();
  await wait(SETTLE_MS);
  await nextFrame();
}

async function waitForThreedEditor(timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    if (
      sceneManager?.camera &&
      sceneManager?.renderer?.domElement &&
      sceneManager?.controlsManager?.cameraControls
    ) {
      return sceneManager;
    }
    await wait(100);
  }
  return null;
}

// Video dimensions from the frame ratio and the requested long side, both
// even (H.264 encodes in 2×2 chroma blocks).
function getVideoSize({ aspectRatio, longSide }) {
  const ratio = ASPECT_RATIOS[aspectRatio] ?? ASPECT_RATIOS.LANDSCAPE;
  const width = ratio >= 1 ? longSide : Math.round(longSide * ratio);
  const height = ratio >= 1 ? Math.round(longSide / ratio) : longSide;
  const even = (v) => Math.max(2, v % 2 === 0 ? v : v + 1);
  return { width: even(width), height: even(height) };
}

// On-screen capture frame (CSS px), measured on the 3D capture host.
function getFrameCssRect({ aspectRatio }) {
  const host = document.querySelector('[data-image-capture-host="THREED"]');
  if (!host) return null;
  const hostBounds = host.getBoundingClientRect();
  return getCaptureRectBounds(hostBounds.width, hostBounds.height, aspectRatio);
}

// Source region of the WebGL canvas matching the on-screen capture frame,
// in canvas backing-store pixels (same offset math as
// snapshotThreedCanvasForCapture).
function getCropRect({ sceneManager, aspectRatio }) {
  const host = document.querySelector('[data-image-capture-host="THREED"]');
  const canvasEl = sceneManager?.renderer?.domElement;
  if (!host || !canvasEl) return null;

  const hostBounds = host.getBoundingClientRect();
  const canvasBounds = canvasEl.getBoundingClientRect();
  const rect = getCaptureRectBounds(
    hostBounds.width,
    hostBounds.height,
    aspectRatio
  );
  if (!(rect.width > 0)) return null;

  const pixelRatio = sceneManager.renderer.getPixelRatio();
  return {
    sx: (rect.left + hostBounds.left - canvasBounds.left) * pixelRatio,
    sy: (rect.top + hostBounds.top - canvasBounds.top) * pixelRatio,
    sw: rect.width * pixelRatio,
    sh: rect.height * pixelRatio,
    cssWidth: rect.width,
  };
}

// Legend + decor (title, border, watermark, logo) over transparency: the
// live WebGL canvas carries no `data-capture-keep`, so captureMapAsPng's
// whitelist pass hides it and only the overlay DOM is captured — already
// cropped to the capture frame.
async function captureOverlay({ aspectRatio }) {
  const blob = await captureMapAsPng({
    viewerKey: "THREED",
    target: "blob",
    aspectRatio,
    pixelRatio: OVERLAY_PIXEL_RATIO,
  });
  if (!blob) return null;
  return { bitmap: await createImageBitmap(blob), size: blob.size };
}

function fileNameNow() {
  const d = new Date();
  const p = (v) => String(v).padStart(2, "0");
  return `points_de_vue_${d.getFullYear()}${p(d.getMonth() + 1)}${p(
    d.getDate()
  )}_${p(d.getHours())}${p(d.getMinutes())}.mp4`;
}

/**
 * Builds an MP4 fly-through chaining the saved 3D points of view: the camera
 * is interpolated between consecutive POVs and every frame is rendered by the
 * three.js renderer, then composited with the POV's legend/decor overlay.
 *
 * 2D POVs are not part of `povs` (their content is DOM/SVG, it cannot be
 * rendered frame by frame) — the caller filters them out.
 *
 * @param {Object[]} povs ordered 3D POVs (>= 1)
 * @param {Function} dispatch
 * @param {Object} settings {holdMs, flightMs, fps, longSide}
 * @param {Function} [onProgress] ({done, total}) => void
 * @param {Function} [shouldCancel] () => boolean, checked on every frame
 */
export default async function generatePovVideoService({
  povs,
  dispatch,
  settings,
  onProgress,
  shouldCancel,
}) {
  const {
    holdMs = 2000,
    flightMs = 2500,
    fps = 30,
    longSide = 1920,
  } = settings ?? {};
  if (!povs?.length) return null;

  // The 3D editor must be the displayed one (and mounted) before anything.
  dispatch(setPovViewerMode("THREED"));
  const sceneManager = await waitForThreedEditor();
  if (!sceneManager) throw new Error("NO_THREED_EDITOR");

  const { renderer, camera, controlsManager } = sceneManager;
  const controls = controlsManager.cameraControls;

  sceneManager.ensureSizeSynced?.();
  await nextFrame();

  // One single frame ratio for the whole video (fixed output dimensions).
  const aspectRatio = povs[0].aspectRatio ?? "LANDSCAPE";
  const { width, height } = getVideoSize({ aspectRatio, longSide });

  const holdFrames = Math.max(1, Math.round((holdMs / 1000) * fps));
  const flightFrames = Math.max(1, Math.round((flightMs / 1000) * fps));
  const totalFrames =
    holdFrames * povs.length + flightFrames * Math.max(0, povs.length - 1);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d", { alpha: false });

  const encoder = await createMp4Encoder({ width, height, fps });

  // State clobbered during the generation, restored in the finally block.
  const prevPixelRatio = renderer.getPixelRatio();
  const prevEnabled = controls.enabled;
  const prevMaxDistance = controls.maxDistance;
  const prevFov = camera.fov;

  let frameIndex = 0;
  const overlays = [];

  function checkCancelled() {
    if (shouldCancel?.()) throw new PovVideoCancelled();
  }

  async function encodeFrame(pose, overlayLayers, crop) {
    checkCancelled();

    camera.fov = pose.fovDeg;
    camera.updateProjectionMatrix();
    // Exact pose: a stale focal offset (orbit-around-cursor) would shift the
    // camera laterally on top of setLookAt (cf. applyPoseAndAnimateFov).
    controls.setFocalOffset(0, 0, 0, false);
    controls.setLookAt(
      pose.position.x,
      pose.position.y,
      pose.position.z,
      pose.target.x,
      pose.target.y,
      pose.target.z,
      false // no transition
    );
    // camera-controls only writes the camera inside update() — even for an
    // instant setLookAt (cf. ControlsManager.applyPoseAndAnimateFov).
    controls.update(0);
    sceneManager.renderScene();

    // Same task as the render: the WebGL drawing buffer is not preserved and
    // gets cleared at the next composite.
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      renderer.domElement,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      width,
      height
    );
    overlayLayers.forEach(({ bitmap, alpha }) => {
      if (!bitmap || alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(bitmap, 0, 0, width, height);
    });
    ctx.globalAlpha = 1;

    await encoder.addFrame(out, frameIndex);
    frameIndex += 1;
    onProgress?.({ done: frameIndex, total: totalFrames });
  }

  try {
    controlsManager.setSuspended(true); // its rAF loop rewrites the camera
    controls.enabled = false;
    controls.maxDistance = Infinity; // saved poses can sit past the dolly limit

    let previousPose = null;
    let previousOverlay = null;

    for (const pov of povs) {
      checkCancelled();

      await applyPovSceneStateService({
        pov,
        dispatch,
        overrideAspectRatio: aspectRatio,
      });
      await settleScene();
      checkCancelled();

      // Export pixel ratio: enough backing-store pixels in the frame to fill
      // the output width without upscaling.
      const cssRect = getFrameCssRect({ aspectRatio });
      const exportPixelRatio = Math.min(
        MAX_EXPORT_PIXEL_RATIO,
        Math.max(1, cssRect?.width ? width / cssRect.width : 1)
      );
      if (renderer.getPixelRatio() !== exportPixelRatio) {
        renderer.setPixelRatio(exportPixelRatio);
      }

      const overlay = await captureOverlay({ aspectRatio });
      if (overlay) overlays.push(overlay);

      const crop = getCropRect({ sceneManager, aspectRatio });
      if (!crop) throw new Error("NO_CAPTURE_FRAME");

      const pose = getPov3dCameraTarget({
        camera3d: pov.camera3d,
        aspectRatio,
      });
      if (!pose) continue; // POV without a usable 3D camera

      // Identical overlays (same legend, same title) must not be crossfaded:
      // two semi-transparent copies of the same pixels read as a flicker.
      // PNGs of identical content are byte-identical, so the blob size is a
      // cheap "same overlay" test.
      const sameOverlay =
        previousOverlay && overlay && previousOverlay.size === overlay.size;

      if (previousPose) {
        for (let f = 0; f < flightFrames; f++) {
          const t = flightFrames > 1 ? f / (flightFrames - 1) : 1;
          const flightPose = getPovFlightPose(previousPose, pose, t);
          const layers = sameOverlay
            ? [{ bitmap: overlay?.bitmap, alpha: 1 }]
            : [
                { bitmap: previousOverlay?.bitmap, alpha: 1 - t },
                { bitmap: overlay?.bitmap, alpha: t },
              ];
          await encodeFrame(flightPose, layers, crop);
        }
      }

      const holdLayers = [{ bitmap: overlay?.bitmap, alpha: 1 }];
      for (let f = 0; f < holdFrames; f++) {
        await encodeFrame(pose, holdLayers, crop);
      }

      previousPose = pose;
      previousOverlay = overlay;
    }

    const blob = await encoder.finish();
    const fileName = fileNameNow();
    downloadBlob(blob, fileName);
    return { fileName, size: blob.size, frames: frameIndex };
  } finally {
    encoder.close();
    overlays.forEach((o) => o.bitmap?.close?.());

    renderer.setPixelRatio(prevPixelRatio);
    camera.fov = prevFov;
    camera.updateProjectionMatrix();
    controls.maxDistance = prevMaxDistance;
    controls.enabled = prevEnabled;
    controlsManager.setSuspended(false);

    // Leave the app on a coherent view (the last POV), camera included. It is
    // also selected so the displayed content and its freeze stay in sync (the
    // POV list clears the freeze when the selection changes).
    const lastPov = povs[povs.length - 1];
    if (lastPov) {
      dispatch(setSelectedItem({ id: lastPov.id, type: "POV" }));
      await restorePovViewService({ pov: lastPov, dispatch });
    }
  }
}
