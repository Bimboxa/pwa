import { Raycaster, Vector2 } from "three";

import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

const VOID_TARGET_DIST = 30; // spray reach when the ray hits nothing
const MUZZLE_DIST = 0.6; // spray origin, in front of the camera near plane

// World point under an NDC coordinate: first mesh hit (clipping/visibility
// aware, fat lines excluded — same filter as useMeshingPointerHandlers'
// pickScene), else a far point along the ray.
export function pickWorldTargetAtNdc({ sceneManager, ndcX, ndcY }) {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), sceneManager.camera);
  const clippingPlane = getActiveClippingPlane(sceneManager);

  const targets = [];
  sceneManager.scene.traverse((obj) => {
    if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
      targets.push(obj);
    }
  });

  const intersects = filterIntersectionsByVisibility(
    filterIntersectionsByClipping(
      raycaster.intersectObjects(targets, false),
      clippingPlane
    )
  );

  if (intersects.length) return intersects[0].point.clone();
  return raycaster.ray.origin
    .clone()
    .addScaledVector(raycaster.ray.direction, VOID_TARGET_DIST);
}

// Spray origin: a screen-anchored point just in front of the camera,
// matching the muzzle of the DOM weapon overlay. Defaults to bottom-center
// (the SVG lance); walk mode passes the RPG image's nozzle position instead.
export function getMuzzleOrigin(
  sceneManager,
  { ndcX = 0, ndcY = -0.85, dist = MUZZLE_DIST } = {}
) {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), sceneManager.camera);
  return raycaster.ray.origin
    .clone()
    .addScaledVector(raycaster.ray.direction, dist);
}
