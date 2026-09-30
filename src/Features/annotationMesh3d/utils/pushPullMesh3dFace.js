import { add, dot, scale } from "../../threedMesh/utils/vec3Utils.js";

import { PARALLEL_DOT } from "./mesh3dConstants.js";
import {
  buildEdgeMap,
  cleanupMesh3d,
  cloneMesh3d,
  getFaceLoops,
  getFaceNormal,
  reverseFace,
} from "./mesh3dTopology.js";

// SketchUp-like push/pull of ONE face of a mesh along its normal.
//
// The face's vertices are duplicated at `+ distance · normal` and the face
// moves there. Each of its edges a→b is then closed according to the
// neighbor face G carrying the reverse edge b→a:
//
// - G contains the push direction (perpendicular to the face): G is
//   stretched (or notched, distance < 0) — its edge b→a becomes the path
//   b, b', a', a. No new face.
// - otherwise (G coplanar with the face, oblique, or no neighbor at all): a
//   new side quad (a, b, b', a') is inserted. Its winding pairs with both G
//   and the moved face, whatever the sign of the distance.
//
// A lone face (no neighbor on any edge) also keeps its original position as
// the opposite cap, so a flat drawn sheet becomes a closed prism.
//
// Vertices left collinear everywhere (the old corners of stretched faces)
// are removed by cleanupMesh3d. Pure: returns a new mesh.
export default function pushPullMesh3dFace(mesh, faceIndex, distance) {
  const source = mesh?.faces?.[faceIndex];
  if (!source || !distance) return mesh;

  const next = cloneMesh3d(mesh);
  const { vertices, faces } = next;
  const target = faces[faceIndex];
  const normal = getFaceNormal(vertices, target);
  const normals = faces.map((face) => getFaceNormal(vertices, face));
  const edgeMap = buildEdgeMap(next);

  // One moved copy per vertex of the face.
  const moved = new Map();
  for (const loop of getFaceLoops(target)) {
    for (const vi of loop) {
      if (moved.has(vi)) continue;
      moved.set(vi, vertices.length);
      vertices.push(add(vertices[vi], scale(normal, distance)));
    }
  }

  const splices = [];
  const sideFaces = [];
  let hasNeighbor = false;
  for (const loop of getFaceLoops(target)) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const partner = edgeMap.get(`${b}_${a}`);
      if (partner && partner.faceIndex !== faceIndex) {
        hasNeighbor = true;
        if (Math.abs(dot(normals[partner.faceIndex], normal)) < PARALLEL_DOT) {
          splices.push({ ...partner, a, b });
          continue;
        }
      }
      sideFaces.push({ loop: [a, b, moved.get(b), moved.get(a)], holes: [] });
    }
  }

  // Stretch / notch the perpendicular neighbors. Located by value: earlier
  // splices shift the indices of the same loop.
  for (const { faceIndex: neighborIndex, loopIndex, a, b } of splices) {
    const loop = getFaceLoops(faces[neighborIndex])[loopIndex];
    for (let i = 0; i < loop.length; i++) {
      if (loop[i] === b && loop[(i + 1) % loop.length] === a) {
        loop.splice(i + 1, 0, moved.get(b), moved.get(a));
        break;
      }
    }
  }

  const original = {
    loop: [...target.loop],
    holes: target.holes.map((h) => [...h]),
  };
  target.loop = target.loop.map((vi) => moved.get(vi));
  target.holes = target.holes.map((hole) => hole.map((vi) => moved.get(vi)));
  faces.push(...sideFaces);

  if (!hasNeighbor) {
    faces.push(reverseFace(original));
    // Pulled "backwards": the prism is built inside out — flip it.
    if (distance < 0) {
      return cleanupMesh3d({ vertices, faces: faces.map(reverseFace) });
    }
  }

  return cleanupMesh3d(next);
}
