import { normalizeAxesYawDeg } from "../../threedEditor/constants/axesDisplay.js";

// Horizontal distance under which the direction is undefined (metres).
const MIN_HORIZONTAL_DISTANCE_M = 0.005;

// Yaw (degrees, [0, 360)) of the user frame whose X axis points from
// `origin` towards `target`, both world Three.js points ({x, y, z}). The
// vertical component is ignored (the frame only rotates around world Y).
// Same convention as getUserAxesWorldDirections: user X = world +X rotated
// by yaw around +Y, so the bearing of X is atan2(-dz, dx). Returns null when
// the target sits (horizontally) on the origin.
export default function computeAxesYawFromPoints(origin, target) {
  if (!origin || !target) return null;
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  if (Math.hypot(dx, dz) < MIN_HORIZONTAL_DISTANCE_M) return null;
  return normalizeAxesYawDeg((Math.atan2(-dz, dx) * 180) / Math.PI);
}
