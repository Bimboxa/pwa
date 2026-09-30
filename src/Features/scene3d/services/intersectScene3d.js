import { Box3, Matrix3, Matrix4, Ray, Raycaster, Vector3 } from "three";

import {
  getActiveClippingPlane,
  isWorldPointVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import {
  ensureScene3dPickData,
  raycastScene3dPickData,
} from "./scene3dPickStore";

// The chunk space of a scan: positions quantized on the unit cube.
const UNIT_BOX = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));

const _raycaster = new Raycaster();
const _inverse = new Matrix4();
const _localRay = new Ray();
const _normalMatrix = new Matrix3();

// Scan roots of the scene that can be drawn on: SCENE_3D annotations shown
// as a mesh (createScene3dAnnotation publishes `userData.scene3dPick`).
function getPickableRoots(editor) {
  const map =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  return Object.values(map).filter(
    (root) => root?.userData?.scene3dPick && isObjectChainVisible(root)
  );
}

// Starts building the picking data of every scan of the scene (see
// scene3dPickStore). Called when a 3D drawing tool is armed so the data is
// (usually) there before the first pointer move.
// → true when at least one scan is still being prepared.
export function prepareScene3dPicking(editor) {
  let loading = false;
  getPickableRoots(editor).forEach((root) => {
    const status = ensureScene3dPickData(root.userData.scene3dPick.sceneId);
    if (status === "LOADING") loading = true;
  });
  return loading;
}

// Point of the SCENE_3D scans under the pointer — the explicit picker of the
// 3D drawing tools (the scan meshes themselves never answer a raycast: a
// scan stays a backdrop for hover, selection and every other tool).
//
// Returns, in the shape computeSnapTarget reads:
//   {position, normal, isScan: true, nodeId, baseMapId, distance} — nearest
//     visible hit (world space; the clipping plane is honoured);
//   {isPending: true} — the pointer is over a scan whose picking data is
//     still being built: the caller must NOT fall back to what lies behind
//     (the point would silently land on the plan under the scan);
//   null — no scan under the pointer.
export default function intersectScene3d(editor, ndc, camera) {
  const sceneManager = editor?.sceneManager;
  if (!sceneManager || !camera) return null;

  const roots = getPickableRoots(editor);
  if (roots.length === 0) return null;

  _raycaster.setFromCamera(ndc, camera);
  const worldRay = _raycaster.ray;
  const clippingPlane = getActiveClippingPlane(sceneManager);

  let best = null;
  let pending = false;
  for (const root of roots) {
    const { sceneId, frame } = root.userData.scene3dPick;
    frame.updateWorldMatrix(true, false);
    _inverse.copy(frame.matrixWorld).invert();
    _localRay.copy(worldRay).applyMatrix4(_inverse);
    if (!_localRay.intersectsBox(UNIT_BOX)) continue;

    // A clipped hit must not shadow the visible surface behind it: with a
    // clipping plane every hit is tested, else the first one is enough.
    const hits = raycastScene3dPickData(sceneId, _localRay, {
      firstOnly: !clippingPlane,
    });
    if (hits === null) {
      if (ensureScene3dPickData(sceneId) !== "MISSING") pending = true;
      continue;
    }

    for (const hit of hits) {
      const position = hit.point.clone().applyMatrix4(frame.matrixWorld);
      if (!isWorldPointVisible(clippingPlane, position)) continue;
      const distance = position.distanceTo(worldRay.origin);
      if (best && distance >= best.distance) continue;

      _normalMatrix.getNormalMatrix(frame.matrixWorld);
      const normal = hit.face.normal
        .clone()
        .applyMatrix3(_normalMatrix)
        .normalize();
      // Double-sided surface: report the side facing the camera.
      if (normal.dot(worldRay.direction) > 0) normal.negate();

      best = {
        position,
        normal,
        isScan: true,
        nodeId: root.userData.nodeId ?? null,
        baseMapId: root.userData.baseMapId ?? null,
        distance,
      };
    }
  }

  if (best) return best;
  return pending ? { isPending: true } : null;
}
