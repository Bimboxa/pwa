import { Vector3 } from "three";

import store from "App/store";

import snapshotPovViewService from "Features/pov/services/snapshotPovViewService";
import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Width / height of the displayed editor, so the stored camera frame is the
// whole viewport (the POV flow stores the frame of its capture rect instead).
function getViewportRatio(viewerMode) {
  if (viewerMode === "MAP") {
    const viewport = getActiveMapEditor()?.getViewportSize?.();
    return viewport?.width && viewport?.height
      ? viewport.width / viewport.height
      : null;
  }
  const host = document.querySelector('[data-image-capture-host="THREED"]');
  const bounds = host?.getBoundingClientRect();
  return bounds?.width && bounds?.height ? bounds.width / bounds.height : null;
}

// Geometry of the 3D clipping plane (world normal + coplanar point), null
// when it is off or was never created.
function snapshotClippingPlane(state) {
  if (!state.threedEditor.clippingPlane?.enabled) return { enabled: false };
  const cm = getActiveThreedEditor()?.sceneManager?.clippingManager;
  const proxy = cm?.gizmoProxy;
  if (!proxy) return { enabled: false };
  const normal = new Vector3(1, 0, 0).applyQuaternion(proxy.quaternion);
  return {
    enabled: true,
    normal: { x: normal.x, y: normal.y, z: normal.z },
    point: { x: proxy.position.x, y: proxy.position.y, z: proxy.position.z },
  };
}

// View context saved on a comment: everything needed to put the reader back
// in the view the author had when writing it.
//
// = the POV view metadata (displayed 2D / 3D editor, camera, main base map +
// active versions, annotation templates visibility — snapshotPovViewService)
// WITHOUT its capture frame settings (legend, background, title… belong to
// the capture tool) and WITHOUT `viewCreatedAt` (a comment never freezes the
// content), plus `extras`: the view state a POV does not record.
export default async function snapshotCommentViewContextService() {
  const state = store.getState();
  const viewerMode = isThreedFamilyViewerKey(selectEffectiveViewerKey(state))
    ? "THREED"
    : "MAP";

  const snapshot = await snapshotPovViewService({
    viewerMode,
    aspectRatio: getViewportRatio(viewerMode) ?? undefined,
  });

  const {
    viewerMode: _viewerMode,
    aspectRatio,
    hiddenAnnotationTemplateIds,
    visibleAnnotationTemplateIds,
    baseMaps,
    camera2d,
    camera3d,
  } = snapshot;

  const viewers = state.viewers;
  const extras = {
    cameraOrtho: Boolean(state.threedEditor.cameraOrtho),
    renderMode: state.threedEditor.renderMode ?? null,
    clippingPlane: snapshotClippingPlane(state),
    hiddenListingsIds: [...(state.listings.hiddenListingsIds ?? [])],
    visibleBaseMapIdsIn2d: [...(viewers.visibleBaseMapIdsIn2d ?? [])],
    annotationsBaseMapIdsIn2d: [...(viewers.annotationsBaseMapIdsIn2d ?? [])],
    hideBaseMapImageInViewer: Boolean(viewers.hideBaseMapImageInViewer),
    hideAnnotationsInViewer: Boolean(viewers.hideAnnotationsInViewer),
    baseMapsImageMode: viewers.baseMapsImageMode ?? null,
  };

  return {
    viewerMode: _viewerMode,
    // numeric ratio of the viewport, only used to re-fit the camera frame
    aspectRatio: typeof aspectRatio === "number" ? aspectRatio : null,
    hiddenAnnotationTemplateIds,
    visibleAnnotationTemplateIds,
    baseMaps,
    camera2d,
    camera3d,
    extras,
  };
}
