import { length, sub } from "../../threedMesh/utils/vec3Utils.js";

import { getFaceLoops } from "./mesh3dTopology.js";

// Total length (m) of the edges of a LOCAL mesh (meters): every edge of every
// loop (outer contours and holes), counted ONCE — an edge shared by two faces
// is the same undirected vertex pair.
export default function getMesh3dEdgesLength(mesh) {
  if (!mesh?.faces?.length) return 0;
  const { vertices, faces } = mesh;

  const seen = new Set();
  let total = 0;
  for (const face of faces) {
    for (const loop of getFaceLoops(face)) {
      for (let index = 0; index < loop.length; index++) {
        const a = loop[index];
        const b = loop[(index + 1) % loop.length];
        if (a === b || !vertices[a] || !vertices[b]) continue;
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        total += length(sub(vertices[b], vertices[a]));
      }
    }
  }
  return total;
}
