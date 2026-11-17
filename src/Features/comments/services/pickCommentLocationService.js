import { Raycaster, Vector2, Vector3 } from "three";

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
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import {
  get2dEditorKeyForModule,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

const toPlain = (v) => (v ? { x: v.x, y: v.y, z: v.z } : null);

// Screen radius (px) of the vertex snap, the 3D drawing tools' own
// (useVertexSnap).
const VERTEX_SNAP_THRESHOLD_PX = 12;
// A vertex this far (m) behind the surface under the cursor is hidden by it.
const OCCLUSION_EPS_M = 5e-3;

// Snappable vertices of the displayed 3D scene (annotation / base map /
// maille vertices, snap anchors) — the index of the 3D drawing tools. Built
// once when the location pick is armed, handed back to the pick as
// `snapVerts`.
export function buildCommentSnapVerts() {
  const scene = getActiveThreedEditor()?.sceneManager?.scene;
  return scene ? buildIndex(scene).verts : [];
}

// World normal of a raycast hit, null when the hit carries no face.
function getHitNormal(hit) {
  if (!hit?.face?.normal) return null;
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
}

// Closest vertex of `snapVerts` within the snap radius of the pointer, among
// the visible ones: in front of the camera, not clipped away, not behind the
// surface under the cursor (`surfaceHit`).
function findVertexSnap({
  ndc,
  hostRect,
  camera,
  ray,
  snapVerts,
  surfaceHit,
  clippingPlane,
}) {
  if (!snapVerts?.length) return null;
  const halfW = hostRect.width / 2;
  const halfH = hostRect.height / 2;
  const mouseX = ndc.x * halfW;
  const mouseY = ndc.y * halfH;

  // Side of the hovered surface the camera looks at it from.
  const normal = getHitNormal(surfaceHit);
  const facing = normal ? (ray.direction.dot(normal) < 0 ? 1 : -1) : 0;

  let best = null;
  let bestSq = VERTEX_SNAP_THRESHOLD_PX * VERTEX_SNAP_THRESHOLD_PX;
  for (const vert of snapVerts) {
    _projected.copy(vert.position).project(camera);
    if (_projected.z < -1 || _projected.z > 1) continue;
    const dx = _projected.x * halfW - mouseX;
    const dy = _projected.y * halfH - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= bestSq) continue;
    if (clippingPlane && clippingPlane.distanceToPoint(vert.position) < 0)
      continue;
    if (normal) {
      const side =
        facing * _delta.subVectors(vert.position, surfaceHit.point).dot(normal);
      if (side < -OCCLUSION_EPS_M) continue;
    }
    bestSq = d2;
    best = vert;
  }
  return best ? best.position.clone() : null;
}

const _projected = new Vector3();
const _delta = new Vector3();

// World point of a new comment under the pointer (client px) in the 3D
// editor: a visible vertex within the snap radius when `snapVerts` is given,
// else the point of the first visible SURFACE (annotation faces, base map
// images, 3D objects). Lines, points, sprites and helpers are skipped as
// surfaces: a comment sits on what the reader sees, not on a wire in front
// of it. Returns { world, isVertex } or null (nothing there). Synchronous:
// the hover preview and the click resolve the very same point.
export function pickCommentWorldPoint({ clientX, clientY, snapVerts = null }) {
  const hostRect = getEditorHostRect(THREED_HOST_SELECTOR);
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const camera = sceneManager?.camera;
  const scene = sceneManager?.scene;
  if (!hostRect || !camera || !scene) return null;

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
  const surfaceHit = hits[0] ?? null;

  const vertex = findVertexSnap({
    ndc,
    hostRect,
    camera,
    ray: raycaster.ray,
    snapVerts,
    surfaceHit,
    clippingPlane,
  });
  if (vertex) return { world: vertex, isVertex: true };
  return surfaceHit ? { world: surfaceHit.point, isVertex: false } : null;
}

// Location of a new comment from a click in the displayed editor (client
// px). Returns { baseMapId, point, worldPosition } or null when nothing can
// be located there (no main base map in 2D, empty space in 3D).
//
// 2D: the click is a point of the MAIN base map; its world position follows
// from the base map 3D placement (null without scale).
// 3D: the click is a world point — a visible vertex within the snap radius
// (`snapVerts`, see buildCommentSnapVerts), else on the first visible
// surface; its 2D point is its projection on the main base map plane (null
// without scale).
// No rounding, no offset: both forms describe the very point picked.
export default async function pickCommentLocationService({
  clientX,
  clientY,
  snapVerts = null,
}) {
  const state = store.getState();
  const effectiveKey = selectEffectiveViewerKey(state);
  const baseMapId = state.mapEditor.selectedBaseMapId ?? null;
  const baseMap = await getBaseMapObjectAsync(baseMapId);

  if (isThreedFamilyViewerKey(effectiveKey)) {
    const world = pickCommentWorldPoint({ clientX, clientY, snapVerts })?.world;
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
