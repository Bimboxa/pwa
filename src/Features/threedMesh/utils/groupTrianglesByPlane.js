import {
  COALESCE_NORMAL_TOL_RAD,
  COALESCE_PLANE_TOL_M,
} from "./coalesceCoplanarFaces.js";
import { cross, dot, length, scale, sub } from "./vec3Utils.js";

// Plane groups of a triangle soup (three-bvh-csg output), each ready for
// coalesceCoplanarFaces. Shared by the two readers of a carved geometry: the
// « Soustraire définitivement » bake (buildMesh3dFromCarvedTriangles) and the
// edge lines rebuilt after a carve (extractPlanarSketchEdges).
//
// coalesceCoplanarFaces groups first-come (the first face of a group sets its
// plane, the next ones join within 0.57 degrees when their first vertex is
// 1 mm from it), which a CSG soup defeats twice:
// - a sliver has a float32-noise normal; seeding a group, it flattens every
//   triangle of the face onto a tilted plane (0.001 rad over a 40 m strip is
//   4 cm);
// - two strips of a sampled arc can meet below 0.57 degrees: they were merged
//   into one planar face, centimetres off the surface.
//
// Pure (no three.js).

// Same value as WELD_PRECISION_M (annotationMesh3d), the codebase-wide "same
// point" scale: below it the altitude of a triangle is position noise.
const SLIVER_ALTITUDE_M = 1e-4;

// Position noise of the soup (m), sized on its largest coordinate like the
// snap grid of coalesceCoplanarFaces: three-bvh-csg stores float32 positions.
const NOISE_MIN_M = 1e-6;
const NOISE_FLOAT32_REL = 4e-6;

// One triangle of the soup, as groupTrianglesByPlane reads it — or null when
// its doubled area is below `minArea2` (no area, no face).
// altitude = smallest altitude (2 * area / longest edge): what conditions a
// normal against position noise.
export function toSoupTriangle(a, b, c, minArea2 = 0) {
  const ab = sub(b, a);
  const ac = sub(c, a);
  const raw = cross(ab, ac);
  const area2 = length(raw);
  if (!(area2 > 0) || area2 < minArea2) return null;
  const longest = Math.max(length(ab), length(ac), length(sub(c, b)));
  return {
    contour: [a, b, c],
    normal: scale(raw, 1 / area2),
    altitude: area2 / longest,
  };
}

// - Seeds: the triangles are visited by decreasing smallest altitude, so a
//   plane is always set by the best triangle lying on it, never by a sliver.
// - Membership: a triangle joins the plane its THREE vertices are closest to
//   (within COALESCE_PLANE_TOL_M), not the first one its first vertex
//   touches: the far edge of a neighbouring strip is off the plane even when
//   the two normals are nearly equal. Its normal must agree too, as far as
//   it is known: position noise tilts the normal of a triangle by up to
//   atan(noise / altitude), which is added to the angular tolerance (a 5 cm
//   chip left by a cut, 0.15 mm thin, was measured 1.8 degrees off its
//   facet). A sliver (altitude below the weld precision) has a normal that
//   says nothing: it is placed by its vertices alone.
// Every member takes the normal of its seed, and the seed comes first: with
// equal normals and vertices within COALESCE_PLANE_TOL_M of the seed plane,
// the grouping of coalesceCoplanarFaces returns each group whole.
//
// @param {Array<{contour, normal, altitude}>} triangles (toSoupTriangle)
// @returns {Array<{n, d, faces: Array<{contour, holes, normal}>}>}
export default function groupTrianglesByPlane(triangles) {
  let maxAbs = 0;
  for (const { contour } of triangles) {
    for (const p of contour) {
      maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
    }
  }
  const noise = Math.min(
    SLIVER_ALTITUDE_M,
    Math.max(NOISE_MIN_M, maxAbs * NOISE_FLOAT32_REL)
  );

  const groups = [];
  const sorted = [...triangles].sort((a, b) => b.altitude - a.altitude);
  for (const triangle of sorted) {
    const isSliver = triangle.altitude < SLIVER_ALTITUDE_M;
    const cosTol = Math.cos(
      COALESCE_NORMAL_TOL_RAD + Math.atan2(noise, triangle.altitude)
    );
    let best = null;
    let bestOffset = Infinity;
    for (const group of groups) {
      if (!isSliver && dot(triangle.normal, group.n) < cosTol) continue;
      let offset = 0;
      for (const p of triangle.contour) {
        offset = Math.max(offset, Math.abs(dot(group.n, p) - group.d));
      }
      if (offset <= COALESCE_PLANE_TOL_M && offset < bestOffset) {
        best = group;
        bestOffset = offset;
      }
    }
    if (!best) {
      best = {
        n: triangle.normal,
        d: dot(triangle.normal, triangle.contour[0]),
        faces: [],
      };
      groups.push(best);
    }
    best.faces.push({ contour: triangle.contour, holes: [], normal: best.n });
  }
  return groups;
}
