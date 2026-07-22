import { add, cross, dot, scale, sub } from "./vec3Utils.js";

// Point of a triangle soup closest to `p`. Used to keep a curved maille's
// label ON its surface: the area-weighted centroid of a ring or of a dome sits
// in the void the shape wraps around, with nothing to attach the card to.
//
// When the centroid already lies on the surface the closest point IS the
// centroid, so flat shells keep their historical anchor untouched.
//
// Pure (no three.js), world coordinates.

// Closest point of triangle (a, b, c) to p — Ericson, Real-Time Collision
// Detection: test the vertex / edge / face Voronoi regions in order.
function closestPointOnTriangle(p, a, b, c) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;

  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    return add(a, scale(ab, d1 / (d1 - d3)));
  }

  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    return add(a, scale(ac, d2 / (d2 - d6)));
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  }

  const denom = 1 / (va + vb + vc);
  return add(a, add(scale(ab, vb * denom), scale(ac, vc * denom)));
}

/**
 * @param {ArrayLike<number>} positions - flat triangle soup (9 per triangle)
 * @param {{x,y,z}} p
 * @returns {{x,y,z}|null}
 */
export default function getShellSurfacePoint(positions, p) {
  if (!positions?.length || !p) return null;
  let best = null;
  let bestDistSq = Infinity;
  for (let t = 0; t + 8 < positions.length; t += 9) {
    const a = { x: positions[t], y: positions[t + 1], z: positions[t + 2] };
    const b = { x: positions[t + 3], y: positions[t + 4], z: positions[t + 5] };
    const c = { x: positions[t + 6], y: positions[t + 7], z: positions[t + 8] };
    // Degenerate triangles have no interior to project onto.
    const n = cross(sub(b, a), sub(c, a));
    if (dot(n, n) < 1e-18) continue;
    const q = closestPointOnTriangle(p, a, b, c);
    const d = sub(q, p);
    const distSq = dot(d, d);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = q;
    }
  }
  return best;
}
