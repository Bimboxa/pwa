import { dot } from "../../threedMesh/utils/vec3Utils.js";

import { getFaceLoops, getFaceNormal } from "./mesh3dTopology.js";

// Undirected edges of a local mesh ({ vertices, faces } — mesh3dTopology),
// each with the fold between the two faces it joins:
//
//   [{ a, b, foldDeg }]   one per edge, in first-seen order (faces, loops)
//
// foldDeg = angle (degrees) between the two face normals — 0 for a coplanar
// split, 15 between two chords of a 24-chord circle, 90 for a box corner. It
// is null when the edge does not join exactly two faces (a free border, a
// T-junction, a non-manifold edge): such an edge is always a real one.
//
// The normals are compared through the winding: two consistently oriented
// neighbours run their common edge in opposite directions; when both run it
// the same way one face is flipped, and its normal is reversed for the fold.
//
// options.skipFaceIndices (Set): faces left out (hidden faces) — an edge
// shared with a skipped face reads as a border of the other one.
//
// Pure (no three.js): replayable from node scripts.
export default function getMesh3dEdgeFolds(mesh, { skipFaceIndices } = {}) {
  const byKey = new Map();
  const edges = [];
  mesh.faces.forEach((face, faceIndex) => {
    if (skipFaceIndices?.has(faceIndex)) return;
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        const forward = a < b;
        const key = forward ? `${a}_${b}` : `${b}_${a}`;
        let edge = byKey.get(key);
        if (!edge) {
          edge = { a, b, uses: [] };
          byKey.set(key, edge);
          edges.push(edge);
        }
        edge.uses.push({ faceIndex, forward });
      }
    }
  });

  const normals = new Map();
  const getNormal = (faceIndex) => {
    if (!normals.has(faceIndex)) {
      normals.set(
        faceIndex,
        getFaceNormal(mesh.vertices, mesh.faces[faceIndex])
      );
    }
    return normals.get(faceIndex);
  };

  return edges.map(({ a, b, uses }) => {
    if (uses.length !== 2 || uses[0].faceIndex === uses[1].faceIndex) {
      return { a, b, foldDeg: null };
    }
    const cos =
      dot(getNormal(uses[0].faceIndex), getNormal(uses[1].faceIndex)) *
      (uses[0].forward === uses[1].forward ? -1 : 1);
    if (!Number.isFinite(cos)) return { a, b, foldDeg: null };
    const foldDeg = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
    return { a, b, foldDeg };
  });
}
