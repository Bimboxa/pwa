import { Matrix3 } from "three";

import { isAnnotationFaceTarget } from "Features/threedDrawing/utils/intersectAnnotationFace";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

const _normalMatrix = new Matrix3();

/**
 * Pickable face meshes of ONE annotation (its managed root, see
 * AnnotationsManager.annotationsObjectsMap) — same exclusions as the scene
 * wide intersectAnnotationFace. Empty for an annotation without a solid.
 */
export function collectAnnotationFaceMeshes(root) {
  const targets = [];
  root?.traverse?.((obj) => {
    if (isAnnotationFaceTarget(obj)) targets.push(obj);
  });
  return targets;
}

/**
 * Closest visible face hit of the (already aimed) raycaster on the given
 * annotation meshes: { position, normal } in world space, the normal facing
 * the camera — or null when the ray misses the annotation.
 *
 * Used to keep the pointed end of an annotation label ON its annotation.
 */
export default function pickAnnotationOwnFace(
  raycaster,
  targets,
  sceneManager
) {
  if (!targets?.length) return null;
  const hits = filterIntersectionsByVisibility(
    filterIntersectionsByClipping(
      raycaster.intersectObjects(targets, false),
      getActiveClippingPlane(sceneManager)
    )
  );
  const hit = hits.find((h) => h.face);
  if (!hit) return null;

  _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal
    .clone()
    .applyMatrix3(_normalMatrix)
    .normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
  return { position: hit.point.clone(), normal };
}
