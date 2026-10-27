// Foot of the perpendicular from `point` on the plane through `planePoint`
// with unit normal `normal` (three.js Vector3s): the start of a measure shot
// perpendicular to that plane (walk-mode laser meter, Shift). → Vector3
export default function getPerpendicularFoot(point, planePoint, normal) {
  const offset = point.clone().sub(planePoint).dot(normal);
  return point.clone().addScaledVector(normal, -offset);
}
