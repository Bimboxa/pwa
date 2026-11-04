import { Vector3 } from "three";

// Orbit / zoom target for a shape just drawn in 3D: among its vertices, the
// one displayed closest to the viewport centre (orbiting around a corner of
// the screen feels off); none on screen → the vertex nearest to the camera.
// `vertices`: world {x, y, z} (the drawing vertices handed to the commit
// services). Returns a new Vector3, or null.
const scratch = new Vector3();

export default function pickOrbitPointForDrawnVertices(vertices, camera) {
  if (!camera || !Array.isArray(vertices) || vertices.length === 0) {
    return null;
  }
  let best = null;
  let bestScore = Infinity;
  let nearest = null;
  let nearestDistSq = Infinity;
  for (const v of vertices) {
    if (
      !v ||
      !Number.isFinite(v.x) ||
      !Number.isFinite(v.y) ||
      !Number.isFinite(v.z)
    ) {
      continue;
    }
    scratch.set(v.x, v.y, v.z);
    const distSq = scratch.distanceToSquared(camera.position);
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = v;
    }
    scratch.project(camera);
    const onScreen =
      scratch.z >= -1 &&
      scratch.z <= 1 &&
      Math.abs(scratch.x) <= 1 &&
      Math.abs(scratch.y) <= 1;
    if (!onScreen) continue;
    const score = scratch.x * scratch.x + scratch.y * scratch.y;
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  }
  const pick = best ?? nearest;
  return pick ? new Vector3(pick.x, pick.y, pick.z) : null;
}
