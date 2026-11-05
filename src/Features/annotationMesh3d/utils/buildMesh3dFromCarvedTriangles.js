import coalesceCoplanarFaces, {
  COALESCE_NORMAL_TOL_RAD,
  COALESCE_PLANE_TOL_M,
} from "../../threedMesh/utils/coalesceCoplanarFaces.js";
import {
  cross,
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";

import { buildMesh3dFromPlanarFaces } from "./buildMesh3dFromTriangles.js";
import { WELD_PRECISION_M } from "./mesh3dConstants.js";

// Triangle soup of a CSG-carved solid -> mesh of planar polygon faces (LOCAL
// form), for the « Soustraire définitivement » bake.
//
// buildMesh3dFromTriangles cannot read a CSG output: three-bvh-csg leaves
// T-junctions between the coplanar triangles of a same face (they share
// partial edges only), so its edge-connected components would split one face
// into many fragments. Here every triangle is its own face and the coplanar
// same-facing triangles are unioned in 2D by coalesceCoplanarFaces (scale-aware
// snap + T-junction repair, built for float32 CSG positions); the welding and
// the cross-face T-junction splice are then the shared second half of
// buildMesh3dFromTriangles.
//
// The triangles are grouped by plane HERE, before the union (groupByPlane):
// coalesceCoplanarFaces groups first-come (the first face of a group sets its
// plane, the next ones join within 0.57 degrees when their first vertex is
// 1 mm from it), which a CSG soup defeats twice:
// - a sliver has a float32-noise normal; seeding a group, it flattens every
//   triangle of the face onto a tilted plane (0.001 rad over a 40 m strip is
//   4 cm);
// - two strips of a sampled arc can meet below 0.57 degrees: they were merged
//   into one planar face, centimetres off the surface.
//
// Pure (no three.js). positions: flat xyz array; index: triangle index or
// null (soup). Returns { vertices, faces } or null.

const MIN_TRIANGLE_AREA2 = 1e-10;

const COS_NORMAL_TOL = Math.cos(COALESCE_NORMAL_TOL_RAD);

// Plane groups of a triangle soup, each ready for coalesceCoplanarFaces.
// - Seeds: the triangles are visited by decreasing smallest altitude
//   (2 * area / longest edge) — what conditions a normal against position
//   noise — so a plane is always set by the best triangle lying on it, never
//   by a sliver.
// - Membership: a triangle joins the plane its THREE vertices are closest to
//   (within COALESCE_PLANE_TOL_M), not the first one its first vertex
//   touches: the far edge of a neighbouring strip is off the plane even when
//   the two normals are nearly equal. Its normal must agree too, unless it
//   is a sliver (altitude below the weld precision), whose normal says
//   nothing.
// Every member takes the normal of its seed, and the seed comes first: with
// equal normals and vertices within COALESCE_PLANE_TOL_M of the seed plane,
// the grouping of coalesceCoplanarFaces returns each group whole.
function groupByPlane(triangles) {
  const groups = [];
  const sorted = [...triangles].sort((a, b) => b.altitude - a.altitude);
  for (const triangle of sorted) {
    const isSliver = triangle.altitude < WELD_PRECISION_M;
    let best = null;
    let bestOffset = Infinity;
    for (const group of groups) {
      if (!isSliver && dot(triangle.normal, group.n) < COS_NORMAL_TOL) continue;
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

export default function buildMesh3dFromCarvedTriangles({
  positions,
  index = null,
}) {
  if (!positions?.length) return null;
  const triCount = (index ? index.length : positions.length / 3) / 3;
  const vertIndex = index ? (t, c) => index[3 * t + c] : (t, c) => 3 * t + c;
  const getPos = (vi) => ({
    x: positions[3 * vi],
    y: positions[3 * vi + 1],
    z: positions[3 * vi + 2],
  });

  const triangles = [];
  for (let t = 0; t < triCount; t++) {
    const a = getPos(vertIndex(t, 0));
    const b = getPos(vertIndex(t, 1));
    const c = getPos(vertIndex(t, 2));
    const ab = sub(b, a);
    const ac = sub(c, a);
    const raw = cross(ab, ac);
    const area2 = length(raw);
    // Slivers are frequent in a CSG output: no area, no face.
    if (area2 < MIN_TRIANGLE_AREA2) continue;
    const longest = Math.max(length(ab), length(ac), length(sub(c, b)));
    triangles.push({
      contour: [a, b, c],
      normal: normalize(raw),
      altitude: area2 / longest,
    });
  }
  if (!triangles.length) return null;

  const faces = groupByPlane(triangles)
    .flatMap((group) => coalesceCoplanarFaces(group.faces))
    .filter((face) => face?.contour?.length >= 3);
  return buildMesh3dFromPlanarFaces(faces);
}
