import { ON_PLANE_TOL_M } from "../../annotationMesh3d/utils/mesh3dConstants.js";
import { getFaceLoops } from "../../annotationMesh3d/utils/mesh3dTopology.js";
import { dot, sub } from "../../threedMesh/utils/vec3Utils.js";

// Pulls the vertices of each mesh onto the nearby vertices and contour
// edges of the OTHER meshes, within MERGE_SNAP_TOL_M, so that the weld
// (WELD_PRECISION_M, 0.1 mm) and the T-junction splice of
// buildMesh3dFromPlanarFaces connect what the user drew as touching.
//
// Why a millimetric tolerance: the meshes come from the live 3D objects
// (convertObject3DToMesh3d) and the builders are not all lifted alike —
// a PX polyline wall (extrudePolylineWall) converts 1 mm lower than the
// polygon sheet it was drawn against — and two shapes drawn in 3D may miss
// each other by a rounding of their 2D points. A vertex wins over an edge.
// The meshes are processed from the last to the first (the seed last), each
// against the current state of the others, so a gap is closed by the
// absorbed mesh whenever its vertices are the ones near the other's edge
// (the wall's top on the slab's edge) and the seed only moves for the gaps
// its own vertices leave.
//
// Pure. Returns new meshes (faces shared, vertices copied).

export const MERGE_SNAP_TOL_M = ON_PLANE_TOL_M;

function contourEdges(mesh) {
  const edges = [];
  for (const face of mesh.faces) {
    for (const loop of getFaceLoops(face)) {
      for (let i = 0; i < loop.length; i++) {
        edges.push([
          mesh.vertices[loop[i]],
          mesh.vertices[loop[(i + 1) % loop.length]],
        ]);
      }
    }
  }
  return edges;
}

function nearestVertex(p, vertices, tol) {
  let best = null;
  let bestD2 = tol * tol;
  for (const v of vertices) {
    const d = sub(v, p);
    const d2 = dot(d, d);
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = v;
    }
  }
  return best;
}

function nearestOnEdge(p, edges, tol) {
  let best = null;
  let bestD2 = tol * tol;
  for (const [a, b] of edges) {
    const e = sub(b, a);
    const lenSq = dot(e, e);
    if (lenSq === 0) continue;
    const t = dot(sub(p, a), e) / lenSq;
    if (t <= 0 || t >= 1) continue;
    const q = { x: a.x + e.x * t, y: a.y + e.y * t, z: a.z + e.z * t };
    const d = sub(q, p);
    const d2 = dot(d, d);
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = q;
    }
  }
  return best;
}

export default function snapMeshesTogether(meshes, tol = MERGE_SNAP_TOL_M) {
  const out = meshes.map((mesh) => ({
    vertices: mesh.vertices.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    faces: mesh.faces,
  }));
  for (let k = out.length - 1; k >= 0; k--) {
    const others = out.filter((_, i) => i !== k);
    const targetVertices = others.flatMap((m) => m.vertices);
    const targetEdges = others.flatMap(contourEdges);
    if (!targetVertices.length) continue;
    out[k].vertices = out[k].vertices.map((p) => {
      const v = nearestVertex(p, targetVertices, tol);
      if (v) return { x: v.x, y: v.y, z: v.z };
      const q = nearestOnEdge(p, targetEdges, tol);
      return q ?? p;
    });
  }
  return out;
}
