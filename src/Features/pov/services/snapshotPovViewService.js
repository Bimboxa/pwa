import * as THREE from "three";

import db from "App/db/db";
import store from "App/store";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Snapshots everything needed to reproduce the current framed view on any
// screen size (see the povs table doc in App/db/db.js).
//
// 2D: the capture rect footprint is stored in baseMap image px — screen px
// depend on the window size, image px don't. screenX = m.x + m.k * (basePose.x
// + basePose.k * imgX) (cf viewerCameraSync), inverted here.
//
// 3D: the camera pose is stored in world coords + the frame fraction
// (rect.height / viewport.height) so the fov can be adjusted at restore time
// to keep the same content inside the frame.
export default async function snapshotPovViewService({ rightInset = 0 } = {}) {
  const state = store.getState();

  const viewerMode = state.pov.viewerMode === "THREED" ? "THREED" : "MAP";
  const aspectRatio = state.mapEditor.imageModeAspectRatio;
  const legendOverlay = state.mapEditor.imageModeLegendOverlay;
  const projectId = state.projects.selectedProjectId;

  // hidden annotation templates (persistent `hidden` flag on the records)
  const templates = await db.annotationTemplates
    .where("projectId")
    .equals(projectId)
    .toArray();
  const hiddenAnnotationTemplateIds = templates
    .filter((t) => !t.deletedAt && t.hidden)
    .map((t) => t.id);

  // baseMaps & active versions
  const mainBaseMapId = state.mapEditor.selectedBaseMapId;
  const visibleBaseMapIdsIn3d = state.threedEditor.visibleBaseMapIdsIn3d ?? [];
  const relevantBaseMapIds = [
    ...new Set([mainBaseMapId, ...visibleBaseMapIdsIn3d].filter(Boolean)),
  ];
  const activeVersionIdByBaseMapId = {};
  for (const baseMapId of relevantBaseMapIds) {
    const versions = await db.baseMapVersions
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    const liveVersions = versions.filter((v) => !v.deletedAt);
    const active = liveVersions.find((v) => v.isActive) || liveVersions[0];
    if (active) activeVersionIdByBaseMapId[baseMapId] = active.id;
  }

  const baseMaps = {
    mainBaseMapId,
    activeVersionIdByBaseMapId,
    visibleBaseMapIdsIn3d,
    hideMainBaseMapImageIn3d: state.threedEditor.hideMainBaseMapImageIn3d,
    hideMainBaseMapAnnotationsIn3d:
      state.threedEditor.hideMainBaseMapAnnotationsIn3d,
  };

  // camera vs frame
  let camera2d = null;
  let camera3d = null;

  if (viewerMode === "MAP") {
    const mapEditor = getActiveMapEditor();
    const m = mapEditor?.getCameraMatrix?.();
    const viewport = mapEditor?.getViewportSize?.();
    const basePose = state.mapEditor.baseMapPoseInBg;
    if (m && viewport?.width && basePose?.k) {
      const rect = getCaptureRectBounds(
        viewport.width,
        viewport.height,
        aspectRatio,
        { rightInset }
      );
      const toImage = (screenX, screenY) => ({
        x: ((screenX - m.x) / m.k - basePose.x) / basePose.k,
        y: ((screenY - m.y) / m.k - basePose.y) / basePose.k,
      });
      const topLeft = toImage(rect.left, rect.top);
      const bottomRight = toImage(
        rect.left + rect.width,
        rect.top + rect.height
      );
      camera2d = {
        footprint: {
          cx: (topLeft.x + bottomRight.x) / 2,
          cy: (topLeft.y + bottomRight.y) / 2,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        },
      };
    }
  } else {
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const camera = sceneManager?.camera;
    const controlsManager = sceneManager?.controlsManager;
    const controls = controlsManager?.cameraControls;
    const host = document.querySelector('[data-image-capture-host="THREED"]');
    if (camera && controls && host) {
      const hostBounds = host.getBoundingClientRect();
      const rect = getCaptureRectBounds(
        hostBounds.width,
        hostBounds.height,
        aspectRatio,
        { rightInset }
      );
      const target = controls.getTarget(new THREE.Vector3());
      camera3d = {
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        target: { x: target.x, y: target.y, z: target.z },
        fovDeg: camera.getEffectiveFOV?.() ?? camera.fov,
        frameFraction: hostBounds.height ? rect.height / hostBounds.height : 1,
      };
    }
  }

  return {
    viewerMode,
    aspectRatio,
    legendOverlay,
    hiddenAnnotationTemplateIds,
    baseMaps,
    camera2d,
    camera3d,
  };
}
