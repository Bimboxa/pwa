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

// Spray origin: bottom-center of the screen, just in front of the camera —
// matches the lance muzzle of the DOM overlay.
export function getMuzzleOrigin(sceneManager) {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, -0.85), sceneManager.camera);
  return raycaster.ray.origin
    .clone()
    .addScaledVector(raycaster.ray.direction, MUZZLE_DIST);
}
