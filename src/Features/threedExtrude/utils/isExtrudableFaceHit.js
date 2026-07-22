import { Matrix3, Vector3 } from "three";

// Only "top" faces can be pushed/pulled: extruding an annotation grows its
// `height` along the baseMap normal, so a click on a lateral face of an
// already-extruded wall has no meaningful mapping and must be ignored.
//
// A face qualifies when its WORLD normal points along the extrusion axis
// within MAX_ANGLE (60°). That tolerance keeps sloped tops (roofs, ramps,
// per-vertex offsetTop faces) extrudable while excluding vertical sides
// (dot ≈ 0) and the bottom cap (dot < 0).
export const TOP_FACE_MIN_DOT = 0.5; // cos(60°)

const _normalMatrix = new Matrix3();
const _worldNormal = new Vector3();

// intersect: a three.js raycast intersection ({ object, face }).
// axis: the extrusion axis in world space (unit Vector3).
export default function isExtrudableFaceHit(intersect, axis) {
  const normal = intersect?.face?.normal;
  const object = intersect?.object;
  if (!normal || !object || !axis) return false;
  _normalMatrix.getNormalMatrix(object.matrixWorld);
  _worldNormal.copy(normal).applyMatrix3(_normalMatrix).normalize();
  return _worldNormal.dot(axis) >= TOP_FACE_MIN_DOT;
}
