import { Vector3 } from "three";

import store from "App/store";

import { setModuleEditorKey } from "Features/viewers/viewersSlice";
import {
  setVisibleBaseMapIdsIn2d,
  setAnnotationsBaseMapIdsIn2d,
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
  setBaseMapsImageMode,
} from "Features/viewers/viewersSlice";
import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import {
  setCameraOrtho,
  setRenderMode,
  setClippingPlaneEnabled,
} from "Features/threedEditor/threedEditorSlice";

import restorePovViewService from "Features/pov/services/restorePovViewService";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The clipping plane geometry is applied once MainThreedEditor has reacted to
// the `enabled` flag (its effect re-creates the plane at the scene centre on
// every enable): right after the render pass, and once more after the slower
// settling (editor switch, textures).
const CLIPPING_REAPPLY_DELAY_MS = 600;

// Bumped on every restore: a pending clipping re-apply of a superseded
// restore (reader clicking another pill) must not win.
let _generation = 0;

function applyClippingPlaneGeometry(clippingPlane) {
  const cm = getActiveThreedEditor()?.sceneManager?.clippingManager;
  if (!cm?.gizmoProxy || !clippingPlane?.normal || !clippingPlane?.point)
    return;
  const { normal, point } = clippingPlane;
  cm.setFromWorldNormalAndPoint(
    new Vector3(normal.x, normal.y, normal.z),
    new Vector3(point.x, point.y, point.z)
  );
}

// Puts the displayed module back in the view saved on a comment
// (snapshotCommentViewContextService): 2D / 3D editor of the CURRENT module,
// view state the POV flow does not record (`extras`), then the POV scene +
// camera restore (flying when the editor and the scene are unchanged).
// The capture frame settings are left untouched (`skipFrame`).
export default async function restoreCommentViewContextService({
  comment,
  dispatch,
}) {
  const viewContext = comment?.viewContext;
  if (!viewContext) return;

  const generation = ++_generation;
  const state = store.getState();
  const viewerMode = viewContext.viewerMode === "THREED" ? "THREED" : "MAP";
  // No 3D editor available: keep the displayed view.
  if (viewerMode === "THREED" && state.appConfig.disable3D) return;

  const moduleKey = state.viewers.selectedViewerKey;
  const previousViewerMode = isThreedFamilyViewerKey(
    selectEffectiveViewerKey(state)
  )
    ? "THREED"
    : "MAP";

  // 1. view state outside the POV metadata
  const extras = viewContext.extras ?? {};
  if (Array.isArray(extras.hiddenListingsIds))
    dispatch(setHiddenListingsIds(extras.hiddenListingsIds));
  if (Array.isArray(extras.visibleBaseMapIdsIn2d))
    dispatch(setVisibleBaseMapIdsIn2d(extras.visibleBaseMapIdsIn2d));
  if (Array.isArray(extras.annotationsBaseMapIdsIn2d))
    dispatch(setAnnotationsBaseMapIdsIn2d(extras.annotationsBaseMapIdsIn2d));
  if (extras.hideBaseMapImageInViewer !== undefined)
    dispatch(setHideBaseMapImageInViewer(extras.hideBaseMapImageInViewer));
  if (extras.hideAnnotationsInViewer !== undefined)
    dispatch(setHideAnnotationsInViewer(extras.hideAnnotationsInViewer));
  if (extras.baseMapsImageMode)
    dispatch(setBaseMapsImageMode(extras.baseMapsImageMode));

  if (viewerMode === "THREED") {
    if (extras.cameraOrtho !== undefined)
      dispatch(setCameraOrtho(extras.cameraOrtho));
    if (extras.renderMode) dispatch(setRenderMode(extras.renderMode));
    if (extras.clippingPlane)
      dispatch(setClippingPlaneEnabled(Boolean(extras.clippingPlane.enabled)));
  }

  // 2. displayed editor of the current module
  if (previousViewerMode !== viewerMode) {
    dispatch(setModuleEditorKey({ moduleKey, editorKey: viewerMode }));
  }

  // 3. scene (templates visibility, base maps, versions) + camera
  await restorePovViewService({
    pov: {
      ...viewContext,
      projectId: comment.projectId,
      // the POV flow falls back to its own frame ratio without one
      aspectRatio: viewContext.aspectRatio ?? undefined,
    },
    dispatch,
    animate: true,
    skipFrame: true,
    previousViewerMode,
  });

  // 4. clipping plane geometry (3D)
  if (viewerMode === "THREED" && extras.clippingPlane?.enabled) {
    const apply = () => {
      if (generation !== _generation) return;
      applyClippingPlaneGeometry(extras.clippingPlane);
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
    setTimeout(apply, CLIPPING_REAPPLY_DELAY_MS);
  }
}
