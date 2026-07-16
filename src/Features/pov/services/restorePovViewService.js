import db from "App/db/db";
import store from "App/store";

import { setPovViewerMode } from "../povSlice";
import {
  setImageModeAspectRatio,
  setImageModeLegendOverlay,
  setImageModeWhiteBackground,
  setImageModeBorder,
  setImageModeTitle,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import {
  setVisibleBaseMapIdsIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
} from "Features/threedEditor/threedEditorSlice";
import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";
import activateBaseMapVersion from "Features/baseMaps/utils/activateBaseMapVersion";

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
    rect.left +
    rect.width / 2 -
    (basePose.x + basePose.k * footprint.cx) * k;
  const y =
    rect.top +
    rect.height / 2 -
    (basePose.y + basePose.k * footprint.cy) * k;
  mapEditor.setCameraMatrix?.({ x, y, k });
}

function applyCamera3d({ camera3d, aspectRatio, rightInset }) {
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const controlsManager = sceneManager?.controlsManager;
  const host = document.querySelector('[data-image-capture-host="THREED"]');
  if (!camera3d?.position || !controlsManager || !host) return;

  const hostBounds = host.getBoundingClientRect();
  const rect = getCaptureRectBounds(
    hostBounds.width,
    hostBounds.height,
    aspectRatio,
    { rightInset }
  );
  const frameFractionNow = hostBounds.height
    ? rect.height / hostBounds.height
    : 1;

  // Same content inside the frame on any screen: the frame's angular height
  // must match the saved one — tan(fov'/2) * f' = tan(fov/2) * f.
  const savedFraction = camera3d.frameFraction || 1;
  const savedFovRad = ((camera3d.fovDeg || 50) * Math.PI) / 180;
  const fovDeg =
    (2 *
      Math.atan(
        (Math.tan(savedFovRad / 2) * savedFraction) / frameFractionNow
      ) *
      180) /
    Math.PI;

  controlsManager.applyPoseAndAnimateFov({
    position: camera3d.position,
    target: camera3d.target,
    fovFrom: fovDeg,
    fovTo: fovDeg,
    durationMs: 0,
  });
}

export default async function restorePovViewService({ pov, dispatch }) {
  if (!pov) return;

  const generation = ++_restoreGeneration;

  const state = store.getState();
  const viewerMode = pov.viewerMode === "THREED" ? "THREED" : "MAP";
  const disable3D = state.appConfig.disable3D;
  if (viewerMode === "THREED" && disable3D) {
    // Keep the selection, skip the view restore: no 3D editor available.
    return;
  }

  // 1. displayed editor (plain flip: the camera is overwritten right after)
  if (state.pov.viewerMode !== viewerMode) {
    dispatch(setPovViewerMode(viewerMode));
  }

  // 2. frame + legend + background
  if (pov.aspectRatio) dispatch(setImageModeAspectRatio(pov.aspectRatio));
  if (pov.legendOverlay) dispatch(setImageModeLegendOverlay(pov.legendOverlay));
  if (pov.whiteBackground !== undefined)
    dispatch(setImageModeWhiteBackground(Boolean(pov.whiteBackground)));
  if (pov.border !== undefined)
    dispatch(setImageModeBorder(Boolean(pov.border)));
  if (pov.title !== undefined) dispatch(setImageModeTitle(pov.title));

  // 3. annotation templates visibility — one batch write, only where the
  // hidden flag actually changes (useUpdateAnnotationTemplates pattern).
  const projectId = pov.projectId ?? state.projects.selectedProjectId;
  if (pov.hiddenAnnotationTemplateIds && projectId) {
    const hiddenSet = new Set(pov.hiddenAnnotationTemplateIds);
    const templates = await db.annotationTemplates
      .where("projectId")
      .equals(projectId)
      .toArray();
    const updates = templates
      .filter((t) => !t.deletedAt)
      .filter((t) => Boolean(t.hidden) !== hiddenSet.has(t.id))
      .map((t) => ({ id: t.id, hidden: hiddenSet.has(t.id) }));
    if (updates.length > 0) {
      await db.transaction("rw", [db.annotationTemplates], async () => {
        await Promise.all(
          updates.map(({ id, hidden }) =>
            db.annotationTemplates.update(id, { hidden })
          )
        );
      });
      dispatch(triggerAnnotationTemplatesUpdate());
      dispatch(triggerAnnotationsUpdate());
    }
  }

  // 4. baseMaps + active versions (guarded: references may have been deleted)
  const povBaseMaps = pov.baseMaps ?? {};
  const { mainBaseMapId, activeVersionIdByBaseMapId } = povBaseMaps;

  let mainBaseMapExists = false;
  if (mainBaseMapId) {
    const mainBaseMap = await db.baseMaps.get(mainBaseMapId);
    mainBaseMapExists = Boolean(mainBaseMap && !mainBaseMap.deletedAt);
    if (
      mainBaseMapExists &&
      state.mapEditor.selectedBaseMapId !== mainBaseMapId
    ) {
      dispatch(setSelectedMainBaseMapId(mainBaseMapId));
    }
  }

  for (const [baseMapId, versionId] of Object.entries(
    activeVersionIdByBaseMapId ?? {}
  )) {
    const version = await db.baseMapVersions.get(versionId);
    if (!version || version.deletedAt) continue;
    if (version.isActive) continue;
    await activateBaseMapVersion(baseMapId, versionId, dispatch);
  }

  if (viewerMode === "THREED") {
    dispatch(
      setVisibleBaseMapIdsIn3d(povBaseMaps.visibleBaseMapIdsIn3d ?? [])
    );
    dispatch(
      setHideMainBaseMapImageIn3d(
        Boolean(povBaseMaps.hideMainBaseMapImageIn3d)
      )
    );
    dispatch(
      setHideMainBaseMapAnnotationsIn3d(
        Boolean(povBaseMaps.hideMainBaseMapAnnotationsIn3d)
      )
    );
  }

  // 5. camera — deferred past the render pass, then re-applied once
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
