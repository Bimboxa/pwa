// Perpendicular measure of the walk-mode laser meter (Shift): from the
// first point `start`, along its plane normal `normal`, to the facing plane
// aimed at — the plane through `point` with normal `pointNormal` (scan plane
// or mesh face). Without a usable facing plane (none, or nearly parallel to
// the direction), the plane through `point` parallel to the first one.
// The sign of `normal` does not matter. three.js Vector3s, unit normals.
// → {end, planeNormal} (planeNormal: the plane intercepted)
const MIN_INCIDENCE = 0.17; // |cos| — beyond ~80°, the intercept runs away

export default function getPerpendicularIntercept(
  start,
  normal,
  point,
  pointNormal = null
) {
  const delta = point.clone().sub(start);
  const incidence = pointNormal ? normal.dot(pointNormal) : 0;
  const facing = Math.abs(incidence) >= MIN_INCIDENCE;
  const t = facing ? delta.dot(pointNormal) / incidence : delta.dot(normal);
  return {
    end: start.clone().addScaledVector(normal, t),
    planeNormal: facing ? pointNormal.clone() : normal.clone(),
  };
}
