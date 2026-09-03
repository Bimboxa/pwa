import { Vector3 } from "three";

// Max distance (m) between the last vertex and the hovered plane for the
// in-plane ortho lock to apply — matches classifyFaceVsBaseMap's OFFSET_EPS_M.
const COPLANAR_EPS_M = 5e-3;

// Pixel corridor matching computeSnapTarget's world-axis threshold.
const ORTHO_THRESHOLD_PX = 20;

function screenDistance(world, mouseNdc, camera, canvasSize) {
  const v = world.clone().project(camera);
  if (v.z < -1 || v.z > 1) return null;
  const dx = ((v.x - mouseNdc.x) * canvasSize.width) / 2;
  const dy = ((v.y - mouseNdc.y) * canvasSize.height) / 2;
  return Math.sqrt(dx * dx + dy * dy);
}

function translateAxis(axis, delta) {
  return [axis[0].clone().add(delta), axis[1].clone().add(delta)];
}

// Ortho lock along the hovered base map plane's own axes: when the last
// committed vertex lies on that plane, the plane hit snaps onto the line
// through the last vertex parallel to one of the image edges (the same axes
// the dashed cross helper draws). Pure 3D test — works for rotated and
// vertical base maps, where the world X/Y/Z axes are NOT in-plane.
//
// Returns { position, kind: "PLANE_ORTHO", axis: "A"|"B", baseMapId, axisA,
// axisB } (cross axes translated to pass through the snapped point) or null.
export default function inPlaneOrthoSnap({
  planeHit,
  lastVertex,
  mouseNdc,
  camera,
  canvasSize,
  thresholdPx = ORTHO_THRESHOLD_PX,
}) {
  if (!planeHit?.position || !planeHit.axisA || !planeHit.axisB || !lastVertex)
    return null;

  const dirA = planeHit.axisA[1].clone().sub(planeHit.axisA[0]);
  const dirB = planeHit.axisB[1].clone().sub(planeHit.axisB[0]);
  if (dirA.lengthSq() < 1e-12 || dirB.lengthSq() < 1e-12) return null;
  dirA.normalize();
  dirB.normalize();

  const normal = dirA.clone().cross(dirB);
  if (normal.lengthSq() < 1e-6) return null;
  normal.normalize();

  const last = new Vector3(lastVertex.x, lastVertex.y, lastVertex.z);
  const toHit = planeHit.position.clone().sub(last);
  if (Math.abs(toHit.dot(normal)) > COPLANAR_EPS_M) return null;

  // The segment last -> candidate runs along `dir`, i.e. parallel to that
  // same cross axis.
  let best = null;
  for (const [dir, axis] of [
    [dirA, "A"],
    [dirB, "B"],
  ]) {
    const candidate = last
      .clone()
      .add(dir.clone().multiplyScalar(toHit.dot(dir)));
    const distance = screenDistance(candidate, mouseNdc, camera, canvasSize);
    if (distance === null || distance >= thresholdPx) continue;
    if (!best || distance < best.distance) best = { candidate, axis, distance };
  }
  if (!best) return null;

  const delta = best.candidate.clone().sub(planeHit.position);
  return {
    position: best.candidate,
    kind: "PLANE_ORTHO",
    axis: best.axis,
    baseMapId: planeHit.baseMapId,
    axisA: translateAxis(planeHit.axisA, delta),
    axisB: translateAxis(planeHit.axisB, delta),
  };
}
