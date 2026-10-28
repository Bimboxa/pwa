import { Vector3 } from "three";

import { pickWorldHitAlongRay } from "Features/threedMesh/services/shootPick";

import getOrthoRayAxis from "../utils/getOrthoRayAxis";
import getUserAxesWorldDirections from "../utils/getUserAxesWorldDirections";

// Perpendicular measure of the walk-mode laser meter (Shift): a ray leaving
// the first point along a half-axis of the displayed frame (± X / Y / Z of
// the gizmo, getUserAxesWorldDirections), stopped by the nearest surface
// along it — meshes and scan base maps (pickWorldHitAlongRay) or the
// displayed point clouds (scanPicker.pickRay, in their workers: the first
// dense slab of points met by a disc sliding along the ray). The crosshair
// only picks the half-axis (getOrthoRayAxis), so there are at most six
// answers per first point, each searched once and cached until reset()
// (new first point, commit, clear).
//
// getAxis(start, aimPoint) → {key, color, dir, id} | null
// get(start, axis) → {status: "HIT", end, planeNormal, hit} |
//   {status: "PENDING"} (search started or running) | {status: "NONE"}
// resolve(start, axis) → Promise<{end, planeNormal, hit} | null>
const MIN_DEPTH_M = 0.05; // the start surface's own faces / points
// Cloud search: a disc of this radius advances along the ray and stops at
// the first slab dense enough (pickLocalScanPoint), never at a lone point.
const SCAN_RAY_RADIUS_M = 0.1;
const SCAN_SLAB_M = 0.05;

export function createWalkOrthoRay({
  sceneManager,
  editor,
  scanPicker,
  getYawDeg,
}) {
  const cache = new Map(); // axis id → {promise, done, result}

  async function search(start, axis) {
    const direction = axis.dir.clone().normalize();
    const meshHit = pickWorldHitAlongRay({
      sceneManager,
      origin: start,
      direction,
      editor,
      minDistance: MIN_DEPTH_M,
    });
    let hit = meshHit;
    if (scanPicker.hasDisplayedScans()) {
      const scanHit = await scanPicker.pickRay(start, direction, {
        radius: SCAN_RAY_RADIUS_M,
        minDepth: MIN_DEPTH_M,
        slab: SCAN_SLAB_M,
      });
      if (scanHit && (!hit || scanHit.distance < hit.distance))
        hit = { ...scanHit, isScan: true };
    }
    if (!hit) return null;
    return {
      end: hit.point.clone(),
      // Target disc at the end: in the surface met, else facing the ray.
      planeNormal: (hit.normal ?? direction).clone(),
      hit,
    };
  }

  function entryFor(start, axis) {
    let entry = cache.get(axis.id);
    if (entry) return entry;
    entry = { done: false, result: null, promise: null };
    entry.promise = search(start, axis)
      .catch((err) => {
        console.error("[walkMode] perpendicular search failed", err);
        return null;
      })
      .then((result) => {
        entry.result = result;
        entry.done = true;
        return result;
      });
    cache.set(axis.id, entry);
    return entry;
  }

  return {
    getAxis(start, aimPoint) {
      const view = sceneManager.camera.getWorldDirection(new Vector3());
      return getOrthoRayAxis(
        start,
        aimPoint,
        getUserAxesWorldDirections(getYawDeg?.() ?? 0),
        view
      );
    },
    get(start, axis) {
      const entry = entryFor(start, axis);
      if (!entry.done) return { status: "PENDING" };
      return entry.result
        ? { status: "HIT", ...entry.result }
        : { status: "NONE" };
    },
    resolve(start, axis) {
      return entryFor(start, axis).promise;
    },
    reset() {
      cache.clear();
    },
  };
}
