import { cross, dot, normalize, scale, sub } from "./vec3Utils.js";

// The 3D scene is Y-up (basemap groups are rotated so basemap-local Z becomes
// world Y — see createObject3DAnnotation.js).
const WORLD_UP = { x: 0, y: 1, z: 0 };
const WORLD_X = { x: 1, y: 0, z: 0 };

// Above this |normal · up| the face is treated as horizontal (floor/roof):
// the in-plane "vertical" is undefined, so the basis falls back to world X.
const NEAR_HORIZONTAL_DOT = 0.95;

/**
 * Orthonormal in-plane basis for a planar face.
 *
 * - `v` is the in-plane "vertical": the projection of world up onto the plane
 *   (what the CUT_VERTICAL tool cuts along).
 * - `u` is the in-plane "horizontal", perpendicular to `v`, with (u, v, n)
 *   right-handed (u × v = n).
 * - Near-horizontal faces fall back to u = projected world X, v = n × u.
 *
 * @param {{x,y,z}} normal - face plane normal (not necessarily unit)
 * @param {{x,y,z}} [origin] - basis origin (defaults to world origin)
 * @returns {{origin, u, v, n}}
 */
export default function computePlaneBasis(
  normal,
  origin = { x: 0, y: 0, z: 0 }
) {
  const n = normalize(normal);

  if (Math.abs(dot(n, WORLD_UP)) > NEAR_HORIZONTAL_DOT) {
    const u = normalize(sub(WORLD_X, scale(n, dot(WORLD_X, n))));
    const v = cross(n, u);
    return { origin, u, v, n, isHorizontalFace: true };
  }

  const v = normalize(sub(WORLD_UP, scale(n, dot(WORLD_UP, n))));
  const u = cross(v, n);
  return { origin, u, v, n, isHorizontalFace: false };
}
