import { Vector3 } from "three";

// Below this length (of the unit axis projected onto the plane) the axis is
// taken as perpendicular to the plane: no in-plane direction.
const MIN_PROJECTED_LENGTH = 1e-3;

// Direction of a user axis once rabatted into a plane: the unit projection of
// `dir` onto the plane of normal `normal` — the "Coupe face" arrow-key axis
// lock keeps the forced point on the face (an axis lying in the face is
// unchanged, Z on a sloped roof becomes its steepest line). Without a normal
// (no face known) the axis is returned as is; null when the axis is
// perpendicular to the plane (nothing to follow). Pure: node-testable.
export default function projectAxisDirInPlane(
  dir,
  normal,
  { minLength = MIN_PROJECTED_LENGTH } = {}
) {
  if (!dir) return null;
  const d = new Vector3(dir.x, dir.y, dir.z);
  if (d.lengthSq() < 1e-12) return null;
  if (!normal) return d.normalize();
  const n = new Vector3(normal.x, normal.y, normal.z);
  if (n.lengthSq() < 1e-12) return d.normalize();
  n.normalize();
  d.normalize();
  const projected = d.addScaledVector(n, -d.dot(n));
  if (projected.length() < minLength) return null;
  return projected.normalize();
}
