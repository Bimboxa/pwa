import { getFaceLoops } from "./mesh3dTopology.js";

const getEdgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

// The edges of every face of a mesh, as vertex pairs (contour + holes):
//
//   [{ faceIndex, edges: [[a, b], …] }]
//
// Same shape as what the face meshes of a mesh annotation carry
// (userData.mesh3dFaceIndex / mesh3dFaceEdges), so the component walk below
// runs alike on a stored mesh and on a displayed one.
export function getMesh3dFacesEdges(mesh) {
  return (mesh?.faces ?? []).map((face, faceIndex) => ({
    faceIndex,
    edges: getFaceLoops(face).flatMap((loop) =>
      loop.map((vi, i) => [vi, loop[(i + 1) % loop.length]])
    ),
  }));
}

// The connected block a face belongs to (double-click on a face): every face
// reached from `seedFaceIndex` through SHARED EDGES, with all their edges.
// Two solids of one annotation that only touch at a vertex — or not at all —
// are two blocks.
//
//   facesEdges: [{ faceIndex, edges: [[a, b], …] }] (getMesh3dFacesEdges, or
//     the face meshes of the displayed object — hidden faces left out)
//   → { faceIndices: [i, …], edges: [[a, b], …] }   (a < b, unique)
//
// The seed face comes first; an unknown seed gives empty lists.
//
// Pure (no three.js): replayable from node scripts.
export default function getMesh3dComponentParts(facesEdges, seedFaceIndex) {
  const byIndex = new Map();
  const facesByEdge = new Map();
  for (const entry of facesEdges ?? []) {
    if (!Number.isInteger(entry?.faceIndex)) continue;
    byIndex.set(entry.faceIndex, entry);
    for (const [a, b] of entry.edges ?? []) {
      const key = getEdgeKey(a, b);
      const list = facesByEdge.get(key);
      if (list) list.push(entry.faceIndex);
      else facesByEdge.set(key, [entry.faceIndex]);
    }
  }
  if (!byIndex.has(seedFaceIndex)) return { faceIndices: [], edges: [] };

  const faceIndices = [];
  const edges = [];
  const seenFaces = new Set([seedFaceIndex]);
  const seenEdges = new Set();
  const queue = [seedFaceIndex];
  while (queue.length) {
    const faceIndex = queue.shift();
    faceIndices.push(faceIndex);
    for (const [a, b] of byIndex.get(faceIndex).edges ?? []) {
      const key = getEdgeKey(a, b);
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        edges.push(a < b ? [a, b] : [b, a]);
      }
      for (const neighbor of facesByEdge.get(key)) {
        if (seenFaces.has(neighbor)) continue;
        seenFaces.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return { faceIndices, edges };
}
