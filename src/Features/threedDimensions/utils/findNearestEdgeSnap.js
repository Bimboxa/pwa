import { Vector3 } from "three";

// Find the closest point lying ON a mesh edge (segment) to the cursor, in
// screen space. Reuses the vertex-adjacency map published in `meshGraphStore`
// by useVertexSnap (shape: Map<key, { position: Vector3, neighbors: Set<key> }>).
//
// Each unique edge (A-B) is projected to pixels; the closest point on the 2D
// segment to the cursor is found via the clamped projection parameter `t`, and
// the world-space snap point is reconstructed as A.lerp(B, t). Returns
// `{ position: Vector3, kind: "EDGE" }` or null when no edge is within
// `pixelThreshold`.
export default function findNearestEdgeSnap(
  adjacency,
  mouseNdc,
  camera,
  canvasSize,
  pixelThreshold = 12
) {
  if (!adjacency || adjacency.size === 0 || !camera || !canvasSize) return null;

  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const mouseX = mouseNdc.x * halfW;
  const mouseY = mouseNdc.y * halfH;

  const pa = new Vector3();
  const pb = new Vector3();

  let best = null;
  let bestSq = pixelThreshold * pixelThreshold;

  for (const [keyA, nodeA] of adjacency) {
    for (const keyB of nodeA.neighbors) {
      // Visit each undirected edge once.
      if (keyA >= keyB) continue;
      const nodeB = adjacency.get(keyB);
      if (!nodeB) continue;

      pa.copy(nodeA.position).project(camera);
      pb.copy(nodeB.position).project(camera);
      if (pa.z < -1 || pa.z > 1 || pb.z < -1 || pb.z > 1) continue;

      const ax = pa.x * halfW;
      const ay = pa.y * halfH;
      const bx = pb.x * halfW;
      const by = pb.y * halfH;

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 1e-6) {
        t = ((mouseX - ax) * dx + (mouseY - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const ddx = projX - mouseX;
      const ddy = projY - mouseY;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = nodeA.position.clone().lerp(nodeB.position, t);
      }
    }
  }

  if (!best) return null;
  return { position: best, kind: "EDGE" };
}
