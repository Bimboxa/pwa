import { getFaceLoops } from "./mesh3dTopology.js";

// A mesh is a closed solid when every directed edge is carried by exactly one
// face and its reverse by exactly one other face (2-manifold, consistently
// oriented). A flat drawn face, or a box pulled out of a flat sheet, is open.
export default function isMesh3dClosed(mesh) {
  if (!mesh?.faces?.length) return false;
  const count = new Map();
  for (const face of mesh.faces) {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const key = `${loop[i]}_${loop[(i + 1) % loop.length]}`;
        count.set(key, (count.get(key) || 0) + 1);
      }
    }
  }
  for (const [key, n] of count) {
    if (n !== 1) return false;
    const [a, b] = key.split("_");
    if (count.get(`${b}_${a}`) !== 1) return false;
  }
  return true;
}
