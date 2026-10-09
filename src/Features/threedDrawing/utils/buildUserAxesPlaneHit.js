import { Vector3 } from "three";

// Half-length (m) of the cross helper drawn through the hit (same as a face
// hit, intersectAnnotationFace).
const CROSS_HALF_LENGTH_M = 0.5;

// In-plane orthonormal basis of a plane made of the two user axes (gizmo
// frame) lying most in the plane, projected onto it: u = the first of them in
// X / Y / Z order, v = the second one made orthogonal to u. On an axis plane
// the basis IS the two other axes (normal Z → X, Y; normal X → Y, Z); on an
// oblique plane it is their projection.
//
// Returns { u: Vector3, v: Vector3, keys: [keyU, keyV] } or null.
export function getUserAxesInPlane(normal, userAxes = []) {
  const n = new Vector3(normal.x, normal.y, normal.z);
  if (n.lengthSq() < 1e-12 || userAxes.length < 2) return null;
  n.normalize();

  const ranked = userAxes
    .map((axis, index) => {
      const dir = new Vector3(axis.dir.x, axis.dir.y, axis.dir.z).normalize();
      const along = dir.dot(n);
      return { key: axis.key, index, dir, inPlane: 1 - along * along };
    })
    .sort((p, q) => q.inPlane - p.inPlane)
    .slice(0, 2)
    .sort((p, q) => p.index - q.index);

  const [first, second] = ranked;
  const u = first.dir.clone().addScaledVector(n, -first.dir.dot(n));
  if (u.lengthSq() < 1e-12) return null;
  u.normalize();
  const v = second.dir
    .clone()
    .addScaledVector(n, -second.dir.dot(n))
    .addScaledVector(u, -second.dir.dot(u));
  if (v.lengthSq() < 1e-12) v.copy(n).cross(u);
  v.normalize();

  return { u, v, keys: [first.key, second.key] };
}

// A plane hit in the shape computeSnapTarget expects (see buildFacePlaneHit):
// the point, the plane normal and a cross helper whose arms follow the user
// axes in the plane — so the in-plane ortho lock snaps along the gizmo axes.
// `isNatural` tags it as a hit on a computed plane, not on a real surface.
export default function buildUserAxesPlaneHit(
  position,
  normal,
  userAxes,
  extra = {},
  crossHalfLength = CROSS_HALF_LENGTH_M
) {
  const basis = getUserAxesInPlane(normal, userAxes);
  if (!basis) return null;
  const pos = new Vector3(position.x, position.y, position.z);
  const arm = (dir) => [
    pos.clone().addScaledVector(dir, -crossHalfLength),
    pos.clone().addScaledVector(dir, crossHalfLength),
  ];
  return {
    position: pos,
    normal: new Vector3(normal.x, normal.y, normal.z).normalize(),
    axisA: arm(basis.u),
    axisB: arm(basis.v),
    axisKeys: { A: basis.keys[0], B: basis.keys[1] },
    isFace: false,
    isNatural: true,
    ...extra,
  };
}
