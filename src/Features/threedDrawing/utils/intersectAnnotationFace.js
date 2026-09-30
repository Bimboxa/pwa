import { Matrix3, Raycaster, Vector3 } from "three";

import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

// Half-length (m) of the cross helper drawn through a face hit.
const CROSS_HALF_LENGTH_M = 0.5;

const _normalMatrix = new Matrix3();

// Cross helper + in-plane axes of a point on a plane: the "horizontal" and
// the "up the slope" directions of the face (computePlaneBasis), so the
// in-plane ortho lock follows the face, whatever its orientation.
export function buildFacePlaneHit(position, normal, extra = {}) {
  const basis = computePlaneBasis(normal, position);
  const segment = (axis) => [
    position
      .clone()
      .add(
        new Vector3(axis.x, axis.y, axis.z).multiplyScalar(-CROSS_HALF_LENGTH_M)
      ),
    position
      .clone()
      .add(
        new Vector3(axis.x, axis.y, axis.z).multiplyScalar(CROSS_HALF_LENGTH_M)
      ),
  ];
  return {
    position,
    normal,
    axisA: segment(basis.u),
    axisB: segment(basis.v),
    isFace: true,
    ...extra,
  };
}

// Raycast the pointer against the annotation solids and return the closest
// face hit, in the same shape as intersectBaseMapPlane so computeSnapTarget
// treats a face like a plan: { position, normal, axisA, axisB, isFace: true,
// nodeId, baseMapId, distance } | null.
//
// This is what lets a point land anywhere ON a face (mesh drawing mode) —
// the vertex / edge snaps only reach its corners and borders.
//
// Targets are collected explicitly (never intersectObjects(scene, true)): fat
// lines extend Mesh and can throw on a stale geometry. Hidden and clipped
// geometry is not pickable.
export default function intersectAnnotationFace(editor, ndc, camera) {
  const sceneManager = editor?.sceneManager;
  const scene = sceneManager?.scene;
  if (!scene || !camera) return null;

  const targets = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.isLine2 || obj.isLineSegments2) return;
    if (obj.userData?.isBasemap || obj.userData?.isHoverOverlay) return;
    targets.push(obj);
  });
  if (!targets.length) return null;

  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = filterIntersectionsByVisibility(
    filterIntersectionsByClipping(
      raycaster.intersectObjects(targets, false),
      getActiveClippingPlane(sceneManager)
    )
  );

  for (const hit of hits) {
    if (!hit.face) continue;
    let owner = hit.object;
    while (owner && owner.userData?.nodeType !== "ANNOTATION") {
      owner = owner.parent;
    }
    if (!owner?.userData?.nodeId) continue;

    _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    const normal = hit.face.normal
      .clone()
      .applyMatrix3(_normalMatrix)
      .normalize();
    // Double-sided solids: report the side facing the camera.
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();

    return buildFacePlaneHit(hit.point.clone(), normal, {
      nodeId: owner.userData.nodeId,
      baseMapId: owner.userData.baseMapId ?? null,
      distance: hit.distance,
    });
  }
  return null;
}
