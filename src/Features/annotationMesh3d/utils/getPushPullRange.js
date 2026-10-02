import { add, dot, scale, sub } from "../../threedMesh/utils/vec3Utils.js";
import { projectPointTo2d } from "../../threedMesh/utils/planeProjection.js";

import {
  COPLANAR_DOT,
  MIN_THICKNESS_M,
  ON_BOUNDARY_TOL_M,
  PARALLEL_DOT,
} from "./mesh3dConstants.js";
import { classifyPointOnFace, getFace2d } from "./mesh3dFace2d.js";
import { buildEdgeMap, getFaceLoops, getFaceNormal } from "./mesh3dTopology.js";

const EPS = 1e-6;

// Allowed push/pull distances of a face: { min, max, through } (meters, along
// the face normal).
//
// Pulling outward is unbounded. Pushing inward (negative) is:
// - free for a lone face (either side makes a prism);
// - refused (min = 0) when a neighbor is oblique — the swept volume would
//   have to be carved out of it, which needs a real boolean;
// - otherwise limited by the material behind the face: the nearest vertex
//   level of the perpendicular neighbors, and the first face hit behind the
//   face's own vertices — minus MIN_THICKNESS_M.
//
// through: { depth } when the mesh is a plain prism along the face (the face,
// its perpendicular sides and ONE opposite cap, `depth` behind it), null
// otherwise. Such a face may be pushed PAST the opposite cap: the solid is
// gone and the move goes on from there (see resolvePushPull). min / max keep
// describing the material limit either way.
export default function getPushPullRange(mesh, faceIndex) {
  const face = mesh?.faces?.[faceIndex];
  if (!face) return { min: 0, max: 0, through: null };

  const { vertices, faces } = mesh;
  const normal = getFaceNormal(vertices, face);
  const normals = faces.map((f) => getFaceNormal(vertices, f));
  const edgeMap = buildEdgeMap(mesh);

  let hasNeighbor = false;
  let depth = Infinity;
  const sides = new Set();
  let isPrism = true;
  for (const loop of getFaceLoops(face)) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const partner = edgeMap.get(`${b}_${a}`);
      if (!partner || partner.faceIndex === faceIndex) continue;
      hasNeighbor = true;
      const cos = dot(normals[partner.faceIndex], normal);
      if (cos > COPLANAR_DOT) {
        isPrism = false;
        continue; // coplanar sibling: pocket wall
      }
      if (Math.abs(cos) >= PARALLEL_DOT) {
        return { min: 0, max: Infinity, through: null }; // oblique neighbor
      }
      sides.add(partner.faceIndex);
      // Perpendicular neighbor: nearest vertex level behind the face.
      for (const neighborLoop of getFaceLoops(faces[partner.faceIndex])) {
        for (const vi of neighborLoop) {
          const h = dot(sub(vertices[vi], vertices[a]), normal);
          if (h < -EPS && -h < depth) depth = -h;
        }
      }
    }
  }
  if (!hasNeighbor) return { min: -Infinity, max: Infinity, through: null };

  // First face behind the vertices of the pushed face (the opposite skin).
  const direction = scale(normal, -1);
  faces.forEach((other, otherIndex) => {
    if (otherIndex === faceIndex) return;
    const denom = dot(direction, normals[otherIndex]);
    if (Math.abs(denom) < PARALLEL_DOT) return;
    const face2d = getFace2d(vertices, other);
    for (const loop of getFaceLoops(face)) {
      for (const vi of loop) {
        const origin = vertices[vi];
        const t =
          dot(sub(vertices[other.loop[0]], origin), normals[otherIndex]) /
          denom;
        if (t <= EPS || t >= depth) continue;
        const hit = add(origin, scale(direction, t));
        const where = classifyPointOnFace(
          face2d,
          other,
          projectPointTo2d(hit, face2d.basis),
          ON_BOUNDARY_TOL_M
        );
        if (where.kind !== "OUTSIDE") depth = t;
      }
    }
  });

  const min = Number.isFinite(depth)
    ? -Math.max(0, depth - MIN_THICKNESS_M)
    : -Infinity;
  const through = isPrism
    ? getThrough({ mesh, faceIndex, normal, normals, sides })
    : null;
  return { min, max: Infinity, through };
}

// Plain prism along the face: beside the face and its perpendicular sides,
// the mesh holds a single face, anti-parallel, and every vertex sits either
// on the face plane or on that opposite plane.
function getThrough({ mesh, faceIndex, normal, normals, sides }) {
  const { vertices, faces } = mesh;
  let oppositeIndex = -1;
  for (let i = 0; i < faces.length; i++) {
    if (i === faceIndex || sides.has(i)) continue;
    if (oppositeIndex !== -1) return null;
    oppositeIndex = i;
  }
  if (oppositeIndex === -1) return null;
  if (dot(normals[oppositeIndex], normal) > -COPLANAR_DOT) return null;

  const origin = vertices[faces[faceIndex].loop[0]];
  const depth = -dot(
    sub(vertices[faces[oppositeIndex].loop[0]], origin),
    normal
  );
  if (!(depth > EPS)) return null;
  for (const face of faces) {
    for (const loop of getFaceLoops(face)) {
      for (const vi of loop) {
        const h = dot(sub(vertices[vi], origin), normal);
        if (
          Math.abs(h) > ON_BOUNDARY_TOL_M &&
          Math.abs(h + depth) > ON_BOUNDARY_TOL_M
        ) {
          return null;
        }
      }
    }
  }
  return { depth };
}
