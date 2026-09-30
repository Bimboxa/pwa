import { dot } from "../../threedMesh/utils/vec3Utils.js";

import { COPLANAR_DOT } from "./mesh3dConstants.js";
import {
  cleanupMesh3d,
  cloneMesh3d,
  getFaceLoops,
  getFaceNormal,
} from "./mesh3dTopology.js";

// Edits of the faces / edges of a LOCAL mesh picked by the user. Pure: every
// function returns a new mesh (or null when the edit does not apply).

// Indices of the faces carrying the edge a–b (either direction).
export function getMesh3dEdgeFaces(mesh, a, b) {
  const faces = [];
  mesh.faces.forEach((face, faceIndex) => {
    const found = getFaceLoops(face).some((loop) =>
      loop.some((vi, i) => {
        const next = loop[(i + 1) % loop.length];
        return (vi === a && next === b) || (vi === b && next === a);
      })
    );
    if (found) faces.push(faceIndex);
  });
  return faces;
}

// An edge can be dissolved when it separates exactly two faces of the same
// plane (typically the two halves of a face cut by a drawn line).
export function canMergeMesh3dFacesAtEdge(mesh, a, b) {
  const faces = getMesh3dEdgeFaces(mesh, a, b);
  if (faces.length !== 2) return false;
  const [n1, n2] = faces.map((i) =>
    getFaceNormal(mesh.vertices, mesh.faces[i])
  );
  return dot(n1, n2) > COPLANAR_DOT;
}

// Removes faces. The mesh is left open where they were. Null when nothing
// would remain.
export function deleteMesh3dFaces(mesh, faceIndices) {
  const removed = new Set(faceIndices);
  const faces = mesh.faces.filter((_, i) => !removed.has(i));
  if (!faces.length) return null;
  if (faces.length === mesh.faces.length) return mesh;
  return cleanupMesh3d({ vertices: mesh.vertices, faces });
}

// Rotates a loop so it starts at the given position.
const rotate = (loop, start) => [...loop.slice(start), ...loop.slice(0, start)];

// Position i of the directed edge from→to in a loop, or -1.
const findEdge = (loop, from, to) =>
  loop.findIndex((vi, i) => vi === from && loop[(i + 1) % loop.length] === to);

// Dissolves the edge a–b: the two coplanar faces it separates become one
// (the reverse of a split). Two layouts:
// - both faces carry the edge on their CONTOUR: the contours are stitched
//   (every other shared edge collapses with it);
// - one face carries it on a HOLE that the other face fills exactly: the hole
//   disappears (the filling face's own holes are kept).
// Null when the edge cannot be dissolved.
export function mergeMesh3dFacesAtEdge(mesh, a, b) {
  if (!canMergeMesh3dFacesAtEdge(mesh, a, b)) return null;
  const next = cloneMesh3d(mesh);
  const [i1, i2] = getMesh3dEdgeFaces(next, a, b);
  const f1 = next.faces[i1];
  const f2 = next.faces[i2];

  // Which loop of each face carries the edge, and in which direction.
  const locate = (face) => {
    const loops = getFaceLoops(face);
    for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        const at = findEdge(loops[loopIndex], from, to);
        if (at >= 0) return { loopIndex, at, from, to };
      }
    }
    return null;
  };
  const e1 = locate(f1);
  const e2 = locate(f2);
  if (!e1 || !e2) return null;

  let merged = null;
  if (e1.loopIndex === 0 && e2.loopIndex === 0) {
    // f1: from → to → rest1…   f2: to → from → rest2…
    // merged contour: to, rest1…, from, rest2… (the shared edge drops out;
    // cleanupMesh3d collapses the other shared edges left as spurs).
    const l1 = rotate(f1.loop, e1.at); // [from, to, ...rest1]
    const l2 = rotate(f2.loop, e2.at); // [to, from, ...rest2] (from its side)
    merged = {
      loop: [l1[1], ...l1.slice(2), l1[0], ...l2.slice(2)],
      holes: [...f1.holes, ...f2.holes],
    };
  } else {
    // A face sitting in a hole of the other one.
    const [outer, inner, outerEdge] =
      e1.loopIndex > 0 && e2.loopIndex === 0
        ? [f1, f2, e1]
        : e2.loopIndex > 0 && e1.loopIndex === 0
          ? [f2, f1, e2]
          : [null, null, null];
    if (!outer) return null;
    const hole = outer.holes[outerEdge.loopIndex - 1];
    const sameRing =
      hole.length === inner.loop.length &&
      hole.every((vi) => inner.loop.includes(vi));
    if (!sameRing) return null;
    merged = {
      loop: outer.loop,
      holes: [
        ...outer.holes.filter((_, i) => i !== outerEdge.loopIndex - 1),
        ...inner.holes,
      ],
    };
  }

  next.faces = next.faces.filter((_, i) => i !== i1 && i !== i2);
  next.faces.push(merged);
  return cleanupMesh3d(next);
}
