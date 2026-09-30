import { Raycaster, Vector2 } from "three";

import intersectScene3d from "Features/scene3d/services/intersectScene3d";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

const VOID_TARGET_DIST = 30; // spray reach when the ray hits nothing
const MUZZLE_DIST = 0.6; // spray origin, in front of the camera near plane

// World point under an NDC coordinate: nearest hit among the meshes
// (clipping/visibility aware, fat lines excluded — same filter as
// useMeshingPointerHandlers' pickScene) and — when `editor` is given — the
// scan base maps (« Scène 3D »): their meshes are a decor that never answers
// a raycast (and drop their CPU arrays once on the GPU), so they are picked
// through intersectScene3d's own CPU data instead. Else a far point along
// the ray. `isHit` tells a real surface from the void fallback (the spray
// splats only on real faces), `isScan` a scan surface.
export function pickWorldHitAtNdc({ sceneManager, ndcX, ndcY, editor = null }) {
  const raycaster = new Raycaster();
  const ndc = new Vector2(ndcX, ndcY);
  raycaster.setFromCamera(ndc, sceneManager.camera);
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

  let best = intersects.length
    ? { point: intersects[0].point.clone(), distance: intersects[0].distance }
    : null;

  // A pending scan (picking data still being built) is simply not hit yet.
  const scanHit = editor
    ? intersectScene3d(editor, ndc, sceneManager.camera)
    : null;
  if (scanHit?.position && (!best || scanHit.distance < best.distance)) {
    best = {
      point: scanHit.position.clone(),
      distance: scanHit.distance,
      isScan: true,
      baseMapId: scanHit.baseMapId ?? null,
    };
  }

  // `baseMapId`: the scan base map hit, if any — it hosts a cote shot on it
  // (commitDrawnCoteService).
  if (best)
    return {
      point: best.point,
      isHit: true,
      isScan: !!best.isScan,
      baseMapId: best.baseMapId ?? null,
    };
  return {
    point: raycaster.ray.origin
      .clone()
      .addScaledVector(raycaster.ray.direction, VOID_TARGET_DIST),
    isHit: false,
    isScan: false,
    baseMapId: null,
  };
}

export function pickWorldTargetAtNdc(args) {
  return pickWorldHitAtNdc(args).point;
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
