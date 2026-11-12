import { Raycaster, Vector2 } from "three";

import store from "App/store";

import getBaseMapObjectAsync from "./getBaseMapObjectAsync";
import {
  THREED_HOST_SELECTOR,
  clientToBaseMapNormalized,
  getEditorHostRect,
  getMapHostSelector,
} from "../utils/commentPinProjection";

import baseMapNormalizedToWorld from "Features/baseMaps/js/baseMapNormalizedToWorld";
import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import {
  get2dEditorKeyForModule,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

const toPlain = (v) => (v ? { x: v.x, y: v.y, z: v.z } : null);

// First visible SURFACE under the pointer (annotation faces, base map
// images, 3D objects). Lines, points, sprites and helpers are skipped: a
// comment sits on what the reader sees, not on a wire in front of it.
function pickWorldPoint({ clientX, clientY, hostRect }) {
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const camera = sceneManager?.camera;
  const scene = sceneManager?.scene;
  if (!camera || !scene) return null;

  const ndc = new Vector2(
    ((clientX - hostRect.left) / hostRect.width) * 2 - 1,
    -((clientY - hostRect.top) / hostRect.height) * 2 + 1
  );
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);

  const clippingPlane = sceneManager.clippingManager?.enabled
    ? sceneManager.clippingManager.plane
    : null;

  const hits = filterIntersectionsByVisibility(
    raycaster.intersectObjects(scene.children, true)
  ).filter((hit) => {
    const obj = hit.object;
    if (!obj.isMesh) return false;
    if (obj.userData?.isClipHelper) return false;
    // clipped away by the cut plane: not visible, not pickable
    if (clippingPlane && clippingPlane.distanceToPoint(hit.point) < 0)
      return false;
    return true;
  });
  return hits[0]?.point ?? null;
}

// Location of a new comment from a click in the displayed editor (client
// px). Returns { baseMapId, point, worldPosition } or null when nothing can
// be located there (no main base map in 2D, empty space in 3D).
//
// 2D: the click is a point of the MAIN base map; its world position follows
// from the base map 3D placement (null without scale).
// 3D: the click is a world point on the first visible surface; its 2D point
// is its projection on the main base map plane (null without scale).
// No rounding, no offset: both forms describe the very point clicked.
export default async function pickCommentLocationService({ clientX, clientY }) {
  const state = store.getState();
  const effectiveKey = selectEffectiveViewerKey(state);
  const baseMapId = state.mapEditor.selectedBaseMapId ?? null;
  const baseMap = await getBaseMapObjectAsync(baseMapId);

  if (isThreedFamilyViewerKey(effectiveKey)) {
    const hostRect = getEditorHostRect(THREED_HOST_SELECTOR);
    if (!hostRect) return null;
    const world = pickWorldPoint({ clientX, clientY, hostRect });
    if (!world) return null;
    const rel = baseMap ? worldToBaseMapNormalized(world, baseMap) : null;
    return {
      baseMapId: baseMap ? baseMapId : null,
      point: rel ? { x: rel.x, y: rel.y } : null,
      worldPosition: toPlain(world),
    };
  }

  if (!baseMap) return null;
  const hostRect = getEditorHostRect(
    getMapHostSelector(get2dEditorKeyForModule(state.viewers.selectedViewerKey))
  );
  if (!hostRect) return null;
  const point = clientToBaseMapNormalized({
    clientX,
    clientY,
    hostRect,
    basePose: state.mapEditor.baseMapPoseInBg,
    imageSize: baseMap.getImageSize(),
  });
  if (!point) return null;
  return {
    baseMapId,
    point,
    worldPosition: toPlain(baseMapNormalizedToWorld(point, baseMap)),
  };
}
