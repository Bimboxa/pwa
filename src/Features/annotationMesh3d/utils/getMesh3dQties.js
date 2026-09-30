import { dot, length } from "../../threedMesh/utils/vec3Utils.js";

import isMesh3dClosed from "./isMesh3dClosed.js";
import { getFaceLoops, getLoopAreaVector } from "./mesh3dTopology.js";

// Quantities of a LOCAL mesh (meters): developed surface (sum of the face
// areas) and volume (divergence theorem over the faces — closed meshes only,
// an open sheet has none).
export default function getMesh3dQties(mesh) {
  if (!mesh?.faces?.length) return { surface: 0, volume: 0 };
  const { vertices, faces } = mesh;

  let surface = 0;
  let volume6 = 0;
  for (const face of faces) {
    let areaVector = { x: 0, y: 0, z: 0 };
    for (const loop of getFaceLoops(face)) {
      const v = getLoopAreaVector(vertices, loop);
      areaVector = {
        x: areaVector.x + v.x,
        y: areaVector.y + v.y,
        z: areaVector.z + v.z,
      };
    }
    surface += length(areaVector) / 2;
    volume6 += dot(vertices[face.loop[0]], areaVector);
  }

  return {
    surface,
    volume: isMesh3dClosed(mesh) ? Math.abs(volume6) / 6 : 0,
  };
}
