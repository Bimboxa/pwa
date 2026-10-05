import { Vector3 } from "three";

const PLANARITY_TOLERANCE_M = 1e-3;
const WELD_PRECISION = 1e4; // 0.1 mm buckets
const MAX_TRIANGLES = 50000;

// Border loops of a PLANAR mesh geometry (indexed or triangle soup), in a 2D
// frame of its plane. Returns null when the geometry is not planar.
//
// Result: { origin, u, v, normal (Vector3, mesh-local), loops ([[x, y], …]) }
// with local = origin + x·u + y·v. `origin` is the plane point closest to the
// local origin and `u` follows the local X axis when it can: two coplanar
// meshes of a same parent share the same frame, and a horizontal face gets
// the plan axes.
export default function getPlanarMeshBoundary(geometry) {
  const position = geometry?.getAttribute?.("position");
  if (!position || position.count < 3) return null;
  const index = geometry.getIndex();
  const triangleCount = (index ? index.count : position.count) / 3;
  if (triangleCount < 1 || triangleCount > MAX_TRIANGLES) return null;
  const getVertexIndex = (i) => (index ? index.getX(i) : i);

  // Plane = the largest triangle (most stable normal).
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cross = new Vector3();
  const normal = new Vector3();
  const anchor = new Vector3();
  let bestArea = 0;
  for (let t = 0; t < triangleCount; t++) {
    a.fromBufferAttribute(position, getVertexIndex(3 * t));
    b.fromBufferAttribute(position, getVertexIndex(3 * t + 1));
    c.fromBufferAttribute(position, getVertexIndex(3 * t + 2));
    cross.subVectors(b, a).cross(c.sub(a));
    const area = cross.length();
    if (area > bestArea) {
      bestArea = area;
      normal.copy(cross);
      anchor.copy(a);
    }
  }
  if (bestArea < 1e-10) return null;
  normal.normalize();

  for (let i = 0; i < position.count; i++) {
    a.fromBufferAttribute(position, i);
    if (Math.abs(a.sub(anchor).dot(normal)) > PLANARITY_TOLERANCE_M) {
      return null;
    }
  }

  const origin = normal.clone().multiplyScalar(anchor.dot(normal));
  const axis =
    Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const u = axis.addScaledVector(normal, -axis.dot(normal)).normalize();
  const v = new Vector3().crossVectors(normal, u);

  // Weld by position, then keep the edges used by a single triangle.
  const weldedIds = new Map();
  const points = [];
  const getWeldedId = (i) => {
    a.fromBufferAttribute(position, getVertexIndex(i)).sub(origin);
    const x = a.dot(u);
    const y = a.dot(v);
    const key = `${Math.round(x * WELD_PRECISION)}_${Math.round(
      y * WELD_PRECISION
    )}`;
    let id = weldedIds.get(key);
    if (id === undefined) {
      id = points.length;
      points.push([x, y]);
      weldedIds.set(key, id);
    }
    return id;
  };

  const edgeCounts = new Map();
  for (let t = 0; t < triangleCount; t++) {
    const ids = [
      getWeldedId(3 * t),
      getWeldedId(3 * t + 1),
      getWeldedId(3 * t + 2),
    ];
    for (let k = 0; k < 3; k++) {
      const p = ids[k];
      const q = ids[(k + 1) % 3];
      if (p === q) continue;
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  const neighbors = new Map();
  const addNeighbor = (p, q) => {
    if (!neighbors.has(p)) neighbors.set(p, []);
    neighbors.get(p).push(q);
  };
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const [p, q] = key.split("_").map(Number);
    addNeighbor(p, q);
    addNeighbor(q, p);
  }

  // Chain the border edges into closed loops.
  const usedEdges = new Set();
  const getEdgeKey = (p, q) => (p < q ? `${p}_${q}` : `${q}_${p}`);
  const loops = [];
  for (const start of neighbors.keys()) {
    for (;;) {
      const loop = [];
      let current = start;
      for (;;) {
        const here = current;
        const next = neighbors
          .get(here)
          .find((q) => !usedEdges.has(getEdgeKey(here, q)));
        if (next === undefined) break;
        usedEdges.add(getEdgeKey(here, next));
        loop.push(points[here]);
        current = next;
        if (current === start) break;
      }
      if (loop.length < 3) break;
      loops.push(loop);
    }
  }
  if (!loops.length) return null;

  return { origin, u, v, normal, loops };
}
