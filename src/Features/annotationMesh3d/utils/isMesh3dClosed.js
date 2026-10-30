import { getFaceLoops } from "./mesh3dTopology.js";

// Directed edges of a mesh with the number of loops running each one.
function countDirectedEdges(mesh) {
  const count = new Map();
  for (const face of mesh.faces) {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        const key = `${loop[i]}_${loop[(i + 1) % loop.length]}`;
        count.set(key, (count.get(key) || 0) + 1);
      }
    }
  }
  return count;
}

const reverseKey = (key) => {
  const [a, b] = key.split("_");
  return `${b}_${a}`;
};

// A mesh is a closed solid when every directed edge is carried by exactly one
// face and its reverse by exactly one other face (2-manifold, consistently
// oriented). A flat drawn face, or the basin dug DOWN out of a flat sheet
// (pushPullMesh3dFace: no cap), is open; a sheet pulled up is a closed prism.
export default function isMesh3dClosed(mesh) {
  if (!mesh?.faces?.length) return false;
  const count = countDirectedEdges(mesh);
  for (const [key, n] of count) {
    if (n !== 1) return false;
    if (count.get(reverseKey(key)) !== 1) return false;
  }
  return true;
}

// A mesh — open or closed — is consistently oriented when no directed edge is
// run twice: two faces sharing an edge run it in opposite directions (what
// buildEdgeMap / pushPullMesh3dFace rely on to find neighbors), and an edge
// run once is a boundary of the surface. The quads of a PX polyline wall
// (extrudePolylineWall) or of a swept ribbon (buildRibbonMesh3d) qualify; a
// soup whose faces were wound independently does not.
export function isMesh3dOriented(mesh) {
  if (!mesh?.faces?.length) return false;
  for (const n of countDirectedEdges(mesh).values()) {
    if (n !== 1) return false;
  }
  return true;
}
