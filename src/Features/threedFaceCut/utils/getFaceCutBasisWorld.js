import { Quaternion, Vector3 } from "three";

import computePlaneBasis from "Features/threedMesh/utils/computePlaneBasis";
import { getUserAxesInPlane } from "Features/threedDrawing/utils/buildUserAxesPlaneHit";

// In-plane frame of a face for the "Coupe face" tools, in world space:
// u = the viewer's horizontal (right when the face is looked at from the
// side `normalWorld` points to — the camera-facing normal of
// intersectAnnotationFace), v = the true vertical (world Y-up) projected on
// the face: what « Découpe horizontale / verticale » cut along, and the X / Y
// of the rectangle's typed dimensions.
//
// Horizontal faces (a floor, a roof) have no in-plane vertical:
// computePlaneBasis falls back to world X there, which is the plan's X only
// for an unplaced base map. The frame then follows the user axes of the
// gizmo frame (`userAxes`, see getUserAxesWorldDirections: X / Y rotated by
// the frame yaw — what the axis locks and the in-plane snaps follow), else
// the host base map's own axes (`baseMapGroup`, the three.js group of the
// annotation's base map): u along +X, v along +Y, kept right-handed with
// the normal.
//
// Returns { origin, u, v, n, isHorizontalFace } (plain {x, y, z} vectors).
export default function getFaceCutBasisWorld(
  normalWorld,
  originWorld,
  baseMapGroup = null,
  userAxes = null
) {
  const basis = computePlaneBasis(normalWorld, originWorld);
  if (!basis.isHorizontalFace) return basis;

  let xDir;
  let yDir;
  if (userAxes?.length) {
    const inPlane = getUserAxesInPlane(normalWorld, userAxes);
    if (!inPlane) return basis;
    xDir = inPlane.u;
    yDir = inPlane.v;
  } else if (baseMapGroup) {
    const q = baseMapGroup.getWorldQuaternion(new Quaternion());
    xDir = new Vector3(1, 0, 0).applyQuaternion(q);
    yDir = new Vector3(0, 1, 0).applyQuaternion(q);
  } else {
    return basis;
  }

  const n = new Vector3(basis.n.x, basis.n.y, basis.n.z);
  const u = xDir.clone();
  u.sub(n.clone().multiplyScalar(u.dot(n)));
  if (u.lengthSq() < 1e-12) return basis;
  u.normalize();
  // u × v = n
  const v = new Vector3().crossVectors(n, u);
  // v along +Y (u flips with it so the frame stays right-handed).
  if (v.dot(yDir) < 0) {
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
