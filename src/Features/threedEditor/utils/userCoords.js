// User-facing coords swap Three.js Y and Z so the user can think
// "Z = vertical / up" (CAD-style) without juggling the engine convention.
// Applied symmetrically to position AND rotation. The swap is its own
// inverse: fromUserCoords(toUserCoords(v)) === v (and vice versa).
export function toUserCoords({ x, y, z }) {
  return { x, y: z, z: y };
}

export function fromUserCoords({ x, y, z }) {
  return { x, y: z, z: y };
}

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

export function eulerRadToDeg({ x, y, z }) {
  return { x: x * DEG_PER_RAD, y: y * DEG_PER_RAD, z: z * DEG_PER_RAD };
}

export function eulerDegToRad({ x, y, z }) {
  return { x: x * RAD_PER_DEG, y: y * RAD_PER_DEG, z: z * RAD_PER_DEG };
}
