// Angular cut (CUT_ANGULAR): the two VERTICAL half-planes bounded by the
// vertical line through the angle vertex O, one holding the direction O→A and
// the other O→B. Together they define a wedge (the angular sector between
// them, always the one under 180°): the maille material inside the wedge
// becomes one maille, the rest the other.
//
// A wedge is a pair of world half-spaces, so it cuts EVERY maille model the
// same way: a single planar face, a multi-face record (an extruded profile
// swept along a polyline) or a curved shell — including vertical faces, which
// a cut path drawn on a face plane could never handle.
//
// The scene is Y-up: O is picked in the horizontal plane of A, so O→A and O→B
// are pure azimuths and both planes are exactly vertical.

const WORLD_UP = { x: 0, y: 1, z: 0 };

// Horizontal (x, z) direction from p to q, normalized. Null when both points
// share the same horizontal position.
export function horizontalDir(p, q) {
  const x = q.x - p.x;
  const z = q.z - p.z;
  const len = Math.hypot(x, z);
  if (len < 1e-9) return null;
  return { x: x / len, z: z / len };
}

// Signed angle (deg) from dirA to dirB around world up (+Y), in (-180, 180].
export function signedAngleDeg(dirA, dirB) {
  const sin = dirA.z * dirB.x - dirA.x * dirB.z;
  const cos = dirA.x * dirB.x + dirA.z * dirB.z;
  return (Math.atan2(sin, cos) * 180) / Math.PI;
}

// Rotate a horizontal direction around +Y (same sign convention as
// signedAngleDeg: rotating dirA by θ yields a direction at signed angle θ).
export function rotateHorizontalDir(dir, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: dir.x * c + dir.z * s, z: -dir.x * s + dir.z * c };
}

// Vertical plane through `o` holding the horizontal direction `dir`, as
// {normal, constant} with the plane being dot(normal, p) === constant. The
// normal is horizontal (up × dir), flipped so that `toward` sits on its
// positive side.
export function getVerticalPlane(o, dir, toward) {
  const normal = {
    x: WORLD_UP.y * dir.z,
    y: 0,
    z: -WORLD_UP.y * dir.x,
  };
  const flip = toward && normal.x * toward.x + normal.z * toward.z < 0 ? -1 : 1;
  const n = { x: normal.x * flip, y: 0, z: normal.z * flip };
  return { normal: n, constant: n.x * o.x + n.z * o.z };
}

/**
 * Reference plane of the angular cut (between the 1st and the 2nd click): the
 * vertical plane through A and the temporary O. Its orientation is irrelevant
 * here — it is only previewed, not used to keep a side.
 *
 * @returns {{normal, constant} | null}
 */
export function getReferencePlane({ o, a }) {
  const dir = horizontalDir(o, a);
  if (!dir) return null;
  return getVerticalPlane(o, dir);
}

/**
 * Wedge between the O→A and O→B half-planes.
 *
 * @param {object} args
 * @param {{x,y,z}} args.o - angle vertex (world), in the horizontal plane of A
 * @param {{x,y,z}} args.a - reference extremity (world)
 * @param {{x,y,z}} args.b - second extremity (world), cursor-driven
 * @param {number} [args.angleDeg] - typed constraint (deg): the mouse then
 *   only picks the side the angle opens to
 * @returns {{ planes: [plane, plane], angleDeg, dirA, dirB } | null}
 */
export default function getAngularWedge({ o, a, b, angleDeg }) {
  const dirA = horizontalDir(o, a);
  let dirB = horizontalDir(o, b);
  if (!dirA || !dirB) return null;

  if (Number.isFinite(angleDeg) && angleDeg > 0) {
    const side = signedAngleDeg(dirA, dirB) < 0 ? -1 : 1;
    dirB = rotateHorizontalDir(dirA, side * angleDeg);
  }

  // A flat (0° / 180°) sector has no inside.
  const angle = Math.abs(signedAngleDeg(dirA, dirB));
  if (angle < 1e-6 || angle > 180 - 1e-6) return null;

  return {
    dirA,
    dirB,
    angleDeg: angle,
    // Each plane keeps the side holding the OTHER direction, so their
    // intersection is exactly the sector between the two half-planes.
    planes: [getVerticalPlane(o, dirA, dirB), getVerticalPlane(o, dirB, dirA)],
  };
}
