import { Vector3 } from "three";

// Picking tolerance for screen-space fat lines, as a fraction of the camera→hit
// distance (≈0.008 rad ≈ a handful of screen px at the editor's FOV), with a
// 2 cm floor so very near lines stay pickable.
const PICK_ANGULAR = 0.008;
const PICK_MIN_M = 0.02;

// Reused temporaries (avoid per-call allocation — raycast runs on every move).
const _a = new Vector3();
const _b = new Vector3();
const _onRay = new Vector3();
const _onSeg = new Vector3();

// Give a Line2 a custom raycast that does NOT rely on three's screen-space
// LineSegments2.raycast: that path needs material.resolution +
// raycaster.params.Line2.threshold to be usable (and historically threw when a
// stale prebundle left resolution undefined, which broke ALL scene picking
// since intersectObjects iterates every object). Here we measure the ray's
// distance to each sub-segment in world space and keep the nearest hit within a
// distance-scaled tolerance, pushing a Mesh-shaped intersection so the existing
// `i.object.isMesh` hover/click filter keeps it (Line2 extends Mesh).
//
// `localPoints` is the polyline in the object's LOCAL space: 2 points for the
// POINT vertical trait, 25 for a full revolution circle.
export default function attachFatLineRaycast(line, localPoints) {
  line.raycast = function (raycaster, intersects) {
    const ray = raycaster.ray;
    let best = null;
    for (let i = 0; i < localPoints.length - 1; i++) {
      _a.copy(localPoints[i]).applyMatrix4(this.matrixWorld);
      _b.copy(localPoints[i + 1]).applyMatrix4(this.matrixWorld);
      const distSq = ray.distanceSqToSegment(_a, _b, _onRay, _onSeg);
      const dist = ray.origin.distanceTo(_onSeg);
      const threshold = Math.max(PICK_MIN_M, PICK_ANGULAR * dist);
      if (distSq <= threshold * threshold && (!best || dist < best.distance)) {
        best = { distance: dist, point: _onSeg.clone(), object: this };
      }
    }
    if (best) intersects.push(best);
  };
}
