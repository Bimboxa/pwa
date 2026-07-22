import buildShellFromRegion from "./buildShellFromRegion.js";
import { dot } from "./vec3Utils.js";

// Splits a curved maille shell (flat triangle soup, world coords) with a
// plane. Triangles fully on one side are kept as-is; crossing ones are clipped
// (Sutherland–Hodgman against each half-space, then fan-triangulated — the
// clip of a triangle is always convex).
//
// Returns the two sides as shell payloads (positions + boundaries + surface,
// same shape as buildShellFromRegion) plus the plane ∩ shell segments, which
// the cut controller draws as the red preview line.
//
// Pure (no three.js), world coordinates. `plane` is {normal: {x,y,z} (unit),
// constant} with the plane being `dot(normal, p) === constant`.

// Distances under this (meters) count as ON the plane: a vertex exactly on the
// cut must not spawn a zero-area sliver on the other side.
const EPS = 1e-9;

// Tolerance for "this boundary edge lies in the cut plane", used to rebuild
// the preview line. Matches the 0.1 mm vertex weld of the boundary loops.
const ON_PLANE_TOL = 1e-4;

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

// Part of `poly` on the `sign` side of the plane (sign: +1 or -1).
function clipToHalfSpace(poly, dists, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const di = sign * dists[i];
    const dj = sign * dists[j];
    if (di >= -EPS) out.push(poly[i]);
    if ((di > EPS && dj < -EPS) || (di < -EPS && dj > EPS)) {
      out.push(lerpPoint(poly[i], poly[j], di / (di - dj)));
    }
  }
  return out;
}

function pushFan(target, poly) {
  for (let i = 1; i + 1 < poly.length; i++) {
    target.push(poly[0], poly[i], poly[i + 1]);
  }
}

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat triangle soup (world)
 * @param {{normal: {x,y,z}, constant: number}} args.plane
 * @returns {{positive, negative, segments: [[{x,y,z},{x,y,z}]]}} sides are
 *   shell payloads or null when empty.
 */
export default function cutShellByPlane({ positions, plane }) {
  if (!positions?.length || !plane?.normal) {
    return { positive: null, negative: null, segments: [] };
  }
  const { normal, constant } = plane;

  const positive = [];
  const negative = [];

  for (let t = 0; t < positions.length / 9; t++) {
    const tri = [0, 1, 2].map((k) => ({
      x: positions[9 * t + 3 * k],
      y: positions[9 * t + 3 * k + 1],
      z: positions[9 * t + 3 * k + 2],
    }));
    const dists = tri.map((p) => dot(normal, p) - constant);

    if (dists.every((d) => d >= -EPS)) {
      positive.push(...tri);
      continue;
    }
    if (dists.every((d) => d <= EPS)) {
      negative.push(...tri);
      continue;
    }

    pushFan(positive, clipToHalfSpace(tri, dists, 1));
    pushFan(negative, clipToHalfSpace(tri, dists, -1));
  }

  const toShell = (points) => {
    if (points.length < 3) return null;
    const flat = new Array(3 * points.length);
    points.forEach((p, i) => {
      flat[3 * i] = p.x;
      flat[3 * i + 1] = p.y;
      flat[3 * i + 2] = p.z;
    });
    return buildShellFromRegion({
      positions: flat,
      index: null,
      tris: Array.from({ length: points.length / 3 }, (_, i) => i),
    });
  };

  const positiveShell = toShell(positive);

  // Preview line = the boundary edges of one side that lie in the plane.
  // Reading it off the boundary (instead of collecting per-triangle crossings)
  // keeps the degenerate case right: a plane running along existing edges cuts
  // nothing yet must still show where it goes.
  const segments = [];
  for (const loop of positiveShell?.boundaries || []) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      if (
        Math.abs(dot(normal, p) - constant) <= ON_PLANE_TOL &&
        Math.abs(dot(normal, q) - constant) <= ON_PLANE_TOL
      ) {
        segments.push([p, q]);
      }
    }
  }

  return {
    positive: positiveShell,
    negative: toShell(negative),
    segments,
  };
}
