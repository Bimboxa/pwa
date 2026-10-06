import { Quaternion, Vector3 } from "three";

import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";

// In-plane frame of a face for the "Coupe face" tools, in world space:
// u = the viewer's horizontal (right when the face is looked at from the
// side `normalWorld` points to — the camera-facing normal of
// intersectAnnotationFace), v = the true vertical (world Y-up) projected on
// the face: what « Découpe horizontale / verticale » cut along, and the X / Y
// of the rectangle's typed dimensions.
//
// Horizontal faces (a floor, a roof) have no in-plane vertical:
// computePlaneBasis falls back to world X there, which is the plan's X only
// for an unplaced base map. The frame then takes the host base map's own
// axes (`baseMapGroup`, the three.js group of the annotation's base map): u
// along the plan's X, v along its Y, kept right-handed with the normal — the
// 2D rectangle tool's frame, so a floor cut follows the plan.
//
// Returns { origin, u, v, n, isHorizontalFace } (plain {x, y, z} vectors).
export default function getFaceCutBasisWorld(
  normalWorld,
  originWorld,
  baseMapGroup = null
) {
  const basis = computePlaneBasis(normalWorld, originWorld);
  if (!basis.isHorizontalFace || !baseMapGroup) return basis;

  const q = baseMapGroup.getWorldQuaternion(new Quaternion());
  const n = new Vector3(basis.n.x, basis.n.y, basis.n.z);
  const u = new Vector3(1, 0, 0).applyQuaternion(q);
  u.sub(n.clone().multiplyScalar(u.dot(n)));
  if (u.lengthSq() < 1e-12) return basis;
  u.normalize();
  // u × v = n
  const v = new Vector3().crossVectors(n, u);
  // v along the plan's +Y (u flips with it so the frame stays right-handed).
  const planY = new Vector3(0, 1, 0).applyQuaternion(q);
  if (v.dot(planY) < 0) {
    u.negate();
    v.negate();
  }
  return {
    origin: basis.origin,
    u: { x: u.x, y: u.y, z: u.z },
    v: { x: v.x, y: v.y, z: v.z },
    n: basis.n,
    isHorizontalFace: true,
  };
}
