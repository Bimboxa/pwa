import { getMesh3dSignedVolume } from "./getMesh3dQties.js";
import isMesh3dClosed from "./isMesh3dClosed.js";
import {
  getFaceLoops,
  getLoopAreaVector,
  reverseFace,
} from "./mesh3dTopology.js";
import { length } from "../../threedMesh/utils/vec3Utils.js";

// Consistent winding of a mesh after a merge of several meshes.
//
// - Closed solid: wound outward (positive signed volume) — the rule every
//   writer applies (convertObject3DToMesh3d, mergeMesh3dSolids).
// - Open 2-manifold surface (every edge carried by at most two faces, e.g.
//   the L profile of a wall sheet merged with a slab sheet): the faces of
//   each connected component are re-wound by a BFS so that two neighbors
//   run their shared edge in opposite directions (isMesh3dOriented — what
//   buildEdgeMap / pushPullMesh3dFace rely on to find a neighbor); the
//   component then keeps the side the largest area of its faces already
//   had, so the faces of the seed mesh (usually the biggest) keep looking
//   the way they did.
// - Non-manifold edge (three faces or more, a sheet crossing another along
//   a shared edge): returned as it is — no consistent orientation exists,
//   the mesh is display-only for the orientation-sensitive tools.
//
// Pure (no three.js). Returns a new mesh (vertices shared).
export default function orientMesh3dFaces(mesh) {
  if (!mesh?.faces?.length) return mesh;
  if (isMesh3dClosed(mesh)) {
    return getMesh3dSignedVolume(mesh) < 0
      ? { vertices: mesh.vertices, faces: mesh.faces.map(reverseFace) }
      : mesh;
  }

  // Undirected edge -> [{ faceIndex, forward }] (forward: the face runs the
  // edge from the smaller vertex index to the larger one).
  const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const byEdge = new Map();
  const faceEdges = mesh.faces.map(() => []);
  mesh.faces.forEach((face, faceIndex) => {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        if (a === b) continue;
        const key = edgeKey(a, b);
        if (!byEdge.has(key)) byEdge.set(key, []);
        byEdge.get(key).push({ faceIndex, forward: a < b });
        faceEdges[faceIndex].push(key);
      }
    }
  });
  for (const uses of byEdge.values()) {
    if (uses.length > 2) return mesh;
  }

  // flip[i]: the face must be reversed relative to its input winding.
  const flip = new Array(mesh.faces.length).fill(null);
  const area = (faceIndex) =>
    getFaceLoops(mesh.faces[faceIndex]).reduce(
      (sum, loop) => sum + length(getLoopAreaVector(mesh.vertices, loop)) / 2,
      0
    );
  for (let seed = 0; seed < mesh.faces.length; seed++) {
    if (flip[seed] !== null) continue;
    flip[seed] = false;
    const component = [seed];
    const queue = [seed];
    while (queue.length) {
      const current = queue.shift();
      for (const key of faceEdges[current]) {
        const uses = byEdge.get(key);
        if (uses.length !== 2) continue;
        const mine = uses.find((u) => u.faceIndex === current);
        const other = uses.find((u) => u.faceIndex !== current);
        if (!other || other.faceIndex === current) continue;
        // Effective directions after the flips decided so far: neighbors
        // must run the edge in opposite directions.
        const myForward = mine.forward !== flip[current];
        const wanted = !myForward; // the neighbor's effective direction
        const neighborFlip = other.forward !== wanted;
        if (flip[other.faceIndex] === null) {
          flip[other.faceIndex] = neighborFlip;
          component.push(other.faceIndex);
          queue.push(other.faceIndex);
        }
        // A conflict (an already visited face that disagrees) means a
        // non-orientable surface: leave it as decided, nothing better exists.
      }
    }
    // Keep the side the largest area of the component already had.
    let flippedArea = 0;
    let keptArea = 0;
    for (const faceIndex of component) {
      if (flip[faceIndex]) flippedArea += area(faceIndex);
      else keptArea += area(faceIndex);
    }
    if (flippedArea > keptArea) {
      for (const faceIndex of component) flip[faceIndex] = !flip[faceIndex];
    }
  }

  if (!flip.some(Boolean)) return mesh;
  return {
    vertices: mesh.vertices,
    faces: mesh.faces.map((face, i) => (flip[i] ? reverseFace(face) : face)),
  };
}
