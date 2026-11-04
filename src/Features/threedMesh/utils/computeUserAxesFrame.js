import computePlaneBasis from "./computePlaneBasis.js";
import { cross, dot, length, normalize, scale, sub } from "./vec3Utils.js";

// In-plane frame of a face aligned on the user axes of the « Repère » (the
// gizmo frame — getUserAxesWorldDirections): the rule of getUserAxesInPlane
// (threedDrawing/utils/buildUserAxesPlaneHit) without three.js.
//
// The two axes lying most in the plane are kept, in X / Y / Z order: u is the
// first one projected on the plane, v = n × u, both flipped when v points
// against the second axis (v follows it, the frame stays right-handed:
// u × v = n). On a vertical wall u is the frame's horizontal and v the true
// vertical; on a floor u / v follow the frame's X / Y (rotated by its yaw).
//
// normal: face normal; origin: frame origin; axesDirs: [{ key, dir: {x,y,z} }]
// (X, Y, Z). Falls back to computePlaneBasis when the axes are unusable.
// Returns { origin, u, v, n, keys }. Pure, node-testable.
export default function computeUserAxesFrame(normal, origin, axesDirs) {
  const n = normalize(normal);
  const ranked = (axesDirs || [])
    .map((axis, index) => {
      const dir = normalize(axis.dir);
      const along = dot(dir, n);
      return { key: axis.key, index, dir, inPlane: 1 - along * along };
    })
    .sort((p, q) => q.inPlane - p.inPlane)
    .slice(0, 2)
    .sort((p, q) => p.index - q.index);
  if (ranked.length < 2) return { ...computePlaneBasis(n, origin), keys: [] };

  const [first, second] = ranked;
  const projected = sub(first.dir, scale(n, dot(first.dir, n)));
  if (length(projected) < 1e-6) {
    return { ...computePlaneBasis(n, origin), keys: [] };
  }
  let u = normalize(projected);
  let v = cross(n, u);
  if (dot(v, second.dir) < 0) {
    u = scale(u, -1);
    v = scale(v, -1);
  }
  return { origin, u, v, n, keys: [first.key, second.key] };
}
