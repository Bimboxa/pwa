import { Vector3 } from "three";

import store from "App/store";

import {
  setModuleEditorKey,
  setSelectedViewerKey,
} from "Features/viewers/viewersSlice";
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
import {
  CONFIGURABLE_MODULE_KEYS,
  selectDisabledModuleKeys,
} from "Features/scopeConfig/utils/scopeConfigSelectors";

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

// Module the reader is sent to: the one the info was written from
// (viewContext.moduleKey), when it differs from the displayed one and is
// still enabled in the scope. Never in a Krto shared with `?mode=viewer`
// (the reader stays in the Viewer). Null = stay in the displayed module.
function resolveModuleSwitch(state, viewContext) {
  const sourceKey = viewContext.moduleKey;
  if (!sourceKey || state.urlParams.viewerMode) return null;
  if (sourceKey === state.viewers.selectedViewerKey) return null;
  if (
    CONFIGURABLE_MODULE_KEYS.includes(sourceKey) &&
    selectDisabledModuleKeys(state).includes(sourceKey)
  )
    return null;
  return sourceKey;
}

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

// Puts the reader back in the view saved on a comment
// (snapshotCommentViewContextService): the MODULE it was written from, its
// 2D / 3D editor, the view state the POV flow does not record (`extras`),
// then the POV scene + camera restore (flying when the editor and the scene
// are unchanged).
// The capture frame settings are left untouched (`skipFrame`).
export default async function restoreCommentViewContextService({
  comment,
  dispatch,
}) {
  const viewContext = comment?.viewContext;
  if (!viewContext) return;

  const generation = ++_generation;

  // 0. module the info was written from — the editors of the target module
  // get two frames to mount / show before the view is applied
  const switchToModuleKey = resolveModuleSwitch(store.getState(), viewContext);
  if (switchToModuleKey) {
    dispatch(setSelectedViewerKey(switchToModuleKey));
    await nextFrame();
    await nextFrame();
    if (generation !== _generation) return;
  }

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
