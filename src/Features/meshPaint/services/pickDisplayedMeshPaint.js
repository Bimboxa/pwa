import { Mesh, Vector3 } from "three";

import {
  filterIntersectionsByClipping,
  isWorldPointVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import {
  BRUSH_EDGE_PICK_PX,
  MESH_PAINT_PART_TYPES,
} from "Features/meshPaint/constants/meshPaintConstants";
import { getMeshPaintObjects } from "Features/meshPaint/js/meshPaintObjectsStore";
import { isSegmentDisplayed } from "Features/meshPaint/utils/clipPaintGeometry";

// Picking of the DISPLAYED painted parts (ThreedMeshPaints objects, published
// in meshPaintObjectsStore) under the cursor. The paint objects disable their
// own raycast so the generic scene pickers (hover / click / snap / tools)
// never see them: this module is the one way to hit a paint, shared by the
// « Pinceau » (meshBrushPick: toggle / replace an existing paint) and by the
// plain hover / click of the 3D editor (tooltip of the painted part, click →
// host selected + paint highlighted).
//
// - FACE paints are raycast explicitly (FrontSide skins: hit from the painted
//   side only); a face paint wins over the surface under the cursor when it
//   is at most PAINT_FACE_WIN_M behind it (it is lifted 1 mm in front of its
//   host).
// - EDGE paints are picked by screen distance (BRUSH_EDGE_PICK_PX) on their
//   displayed segments, skipping points hidden behind the surface under the
//   cursor (OCCLUSION_EPS_M) or cut away by the clipping plane.

// A vertex / edge further than this (m) behind the surface under the cursor
// is hidden by it (computeSnapTarget's rule; absorbs the 1 mm lifts).
export const OCCLUSION_EPS_M = 5e-3;
// A face paint wins over the surface hit when it is at most this much behind
// it (it is lifted 1 mm in front of its host).
export const PAINT_FACE_WIN_M = 0.002;

const FACE = MESH_PAINT_PART_TYPES.FACE;
const EDGE = MESH_PAINT_PART_TYPES.EDGE;

/**
 * Screen distance (px) from the cursor to a world segment, clipped by the
 * camera near plane, with the world point under the closest screen point
 * (perspective-correct, see findNearestEdgeSnap).
 *
 * cursor: { x, y } in canvas px (client coords minus the canvas rect).
 */
export function getSegmentScreenHit(a, b, camera, rect, cursor) {
  const va = a.clone().applyMatrix4(camera.matrixWorldInverse);
  const vb = b.clone().applyMatrix4(camera.matrixWorldInverse);
  if (camera.isPerspectiveCamera) {
    const zNear = -(camera.near || 0.01) * 1.001;
    const aIn = va.z <= zNear;
    const bIn = vb.z <= zNear;
    if (!aIn && !bIn) return null;
    if (!aIn) va.lerp(vb, (zNear - va.z) / (vb.z - va.z));
    if (!bIn) vb.lerp(va, (zNear - vb.z) / (va.z - vb.z));
  }
  const wa = va.clone().applyMatrix4(camera.matrixWorld);
  const wb = vb.clone().applyMatrix4(camera.matrixWorld);
  const pa = wa.clone().project(camera);
  const pb = wb.clone().project(camera);
  if (pa.z > 1 && pb.z > 1) return null; // beyond the far plane
  const ax = ((pa.x + 1) / 2) * rect.width;
  const ay = ((1 - pa.y) / 2) * rect.height;
  const bx = ((pb.x + 1) / 2) * rect.width;
  const by = ((1 - pb.y) / 2) * rect.height;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-9) {
    t = ((cursor.x - ax) * dx + (cursor.y - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const distancePx = Math.hypot(ax + t * dx - cursor.x, ay + t * dy - cursor.y);
  // Clip-space w = view depth (perspective), 1 (orthographic).
  const wA = camera.isPerspectiveCamera ? -va.z : 1;
  const wB = camera.isPerspectiveCamera ? -vb.z : 1;
  const denom = (1 - t) * wB + t * wA;
  const s = Math.abs(denom) > 1e-12 ? (t * wA) / denom : t;
  return { distancePx, point: wa.clone().lerp(wb, s) };
}

// Displayed paint objects of one part type that a pointer may target.
export function getPickablePaints(partType) {
  const out = [];
  for (const object of getMeshPaintObjects().values()) {
    const userData = object?.userData;
    if (userData?.partType !== partType) continue;
    // Forced on screen by a panel highlight only: not a target.
    if (userData.visibility === "HIDDEN") continue;
    if (!isObjectChainVisible(object)) continue;
    out.push(object);
  }
  return out;
}

// Plane of the surface under the cursor (a scene intersection with a face),
// facing the camera. null without a face hit.
export function getOccluder(intersect, rayDirection) {
  if (!intersect?.face?.normal) return null;
  intersect.object.updateWorldMatrix(true, false);
  const normal = intersect.face.normal
    .clone()
    .transformDirection(intersect.object.matrixWorld);
  if (rayDirection && normal.dot(rayDirection) > 0) normal.negate();
  return { point: intersect.point.clone(), normal };
}

// Predicate "this world point is visible": not cut away by the clipping
// plane, not behind the occluder plane.
export function makeAccept(clippingPlane, occluder) {
  const offset = new Vector3();
  return (point) => {
    if (!isWorldPointVisible(clippingPlane, point)) return false;
    if (!occluder) return true;
    offset.copy(point).sub(occluder.point);
    return offset.dot(occluder.normal) >= -OCCLUSION_EPS_M;
  };
}

// Nearest FACE paint along the ray (a Mesh intersection) or null.
export function pickPaintFace(raycaster, clippingPlane) {
  const hits = [];
  for (const object of getPickablePaints(FACE)) {
    if (!object.isMesh) continue;
    object.updateWorldMatrix(true, false);
    // The paint's own raycast is disabled (generic pickers skip it).
    Mesh.prototype.raycast.call(object, raycaster, hits);
  }
  hits.sort((a, b) => a.distance - b.distance);
  return filterIntersectionsByClipping(hits, clippingPlane)[0] ?? null;
}

// Nearest EDGE paint on screen: { object, distancePx, point } or null.
export function pickPaintEdge({ camera, rect, cursor, accept }) {
  let best = null;
  for (const object of getPickablePaints(EDGE)) {
    const points = object.userData.localGeometry?.points ?? [];
    if (points.length < 2) continue;
    object.updateWorldMatrix(true, false);
    const world = points.map((p) =>
      new Vector3(p.x, p.y, p.z).applyMatrix4(object.matrixWorld)
    );
    // Every displayed segment (a curve has several).
    const clip = object.userData.clip ?? null;
    for (let i = 0; i + 1 < world.length; i++) {
      if (!isSegmentDisplayed(points[i], points[i + 1], clip)) continue;
      const hit = getSegmentScreenHit(
        world[i],
        world[i + 1],
        camera,
        rect,
        cursor
      );
      if (!hit || hit.distancePx > BRUSH_EDGE_PICK_PX) continue;
      if (!accept(hit.point)) continue;
      if (!best || hit.distancePx < best.distancePx) {
        best = { object, distancePx: hit.distancePx, point: hit.point };
      }
    }
  }
  return best;
}

function describe(object, extra) {
  const userData = object.userData;
  return {
    object,
    paintId: userData.meshPaintId,
    partType: userData.partType,
    hostAnnotationId: userData.hostAnnotationId,
    annotationTemplateId: userData.annotationTemplateId,
    baseMapId: userData.baseMapId,
    ...extra,
  };
}

/**
 * Painted part under the cursor for the plain hover / click of the 3D
 * editor: an EDGE paint within BRUSH_EDGE_PICK_PX (a thin, deliberate
 * target) wins over a FACE paint under the cursor; a face paint wins over the
 * scene surface when it sits on it (PAINT_FACE_WIN_M).
 *
 * @param {Object} params
 * @param {import("three").Raycaster} params.raycaster - set from the cursor.
 * @param {import("three").Camera} params.camera
 * @param {DOMRect} params.rect - canvas bounding rect.
 * @param {{x: number, y: number}} params.cursor - canvas px.
 * @param {import("three").Plane|null} params.clippingPlane
 * @param {Object|null} params.sceneHit - nearest generic scene intersection
 *   (a face of an annotation / base map…), the occluder of hidden points.
 * @returns {{ object, paintId, partType, hostAnnotationId,
 *   annotationTemplateId, baseMapId, point: Vector3,
 *   distance?: number, distancePx?: number } | null}
 */
export default function pickDisplayedMeshPaint({
  raycaster,
  camera,
  rect,
  cursor,
  clippingPlane = null,
  sceneHit = null,
}) {
  if (!raycaster || !camera || !rect?.width || !cursor) return null;
  if (getMeshPaintObjects().size === 0) return null;

  const accept = makeAccept(
    clippingPlane,
    getOccluder(sceneHit, raycaster.ray.direction)
  );
  const edge = pickPaintEdge({ camera, rect, cursor, accept });
  if (edge) {
    return describe(edge.object, {
      point: edge.point,
      distancePx: edge.distancePx,
    });
  }

  const face = pickPaintFace(raycaster, clippingPlane);
  if (
    face &&
    face.distance <= (sceneHit?.distance ?? Infinity) + PAINT_FACE_WIN_M
  ) {
    return describe(face.object, {
      point: face.point.clone(),
      distance: face.distance,
    });
  }
  return null;
}
