import { Matrix3, Raycaster, Vector2 } from "three";

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
  return pickWorldHit({ sceneManager, raycaster, ndc, editor });
}

// Same pick along an arbitrary world ray (origin + unit direction): hits
// nearer than `minDistance` are skipped (a ray leaving a surface must not
// hit that surface). → {point, distance, normal, isScan, baseMapId} | null
// (no void fallback: nothing along the ray is nothing).
export function pickWorldHitAlongRay({
  sceneManager,
  origin,
  direction,
  editor = null,
  minDistance = 0,
}) {
  const raycaster = new Raycaster(origin, direction.clone().normalize());
  raycaster.near = minDistance;
  const hit = pickWorldHit({ sceneManager, raycaster, ndc: null, editor });
  if (!hit.isHit || hit.distance < minDistance) return null;
  return hit;
}

function pickWorldHit({ sceneManager, raycaster, ndc, editor }) {
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

  // World normal of the face hit (meshes only): the plane of a laser meter
  // first point, for a perpendicular second shot.
  const first = intersects[0];
  let best = first
    ? {
        point: first.point.clone(),
        distance: first.distance,
        normal: first.face
          ? first.face.normal
              .clone()
              .applyMatrix3(
                new Matrix3().getNormalMatrix(first.object.matrixWorld)
              )
              .normalize()
          : null,
      }
    : null;

  // A pending scan (picking data still being built) is simply not hit yet.
  const scanHit = editor
    ? intersectScene3d(editor, ndc, sceneManager.camera, {
        ray: ndc ? null : raycaster.ray,
      })
    : null;
  if (
    scanHit?.position &&
    scanHit.distance >= raycaster.near &&
    (!best || scanHit.distance < best.distance)
  ) {
    best = {
      point: scanHit.position.clone(),
      distance: scanHit.distance,
      isScan: true,
      baseMapId: scanHit.baseMapId ?? null,
      normal: scanHit.normal ?? null,
    };
  }

  // `baseMapId`: the scan base map hit, if any — it hosts a cote shot on it
  // (commitDrawnCoteService).
  if (best)
    return {
      point: best.point,
      distance: best.distance,
      isHit: true,
      isScan: !!best.isScan,
      baseMapId: best.baseMapId ?? null,
      normal: best.normal ?? null,
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
