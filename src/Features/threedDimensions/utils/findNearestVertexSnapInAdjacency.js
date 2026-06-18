import { Vector3 } from "three";

// Find the closest adjacency NODE (vertex) to the cursor, in screen space.
// Mirrors useVertexSnap.findNearestSnap but reads positions straight from an
// adjacency map (shape: Map<key, { position: Vector3, neighbors: Set<key> }>),
// used for snapping onto the cut-contour vertices. Returns
// `{ position: Vector3, kind: "VERTEX" }` or null when none is within
// `pixelThreshold`.
export default function findNearestVertexSnapInAdjacency(
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

  let best = null;
  let bestSq = pixelThreshold * pixelThreshold;
  const tmp = new Vector3();

  for (const [, node] of adjacency) {
    tmp.copy(node.position).project(camera);
    if (tmp.z < -1 || tmp.z > 1) continue; // behind camera or beyond far plane
    const sx = tmp.x * halfW;
    const sy = tmp.y * halfH;
    const dx = sx - mouseX;
    const dy = sy - mouseY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestSq) {
      bestSq = d2;
      best = node;
    }
  }

  if (!best) return null;
  return {
    position: new Vector3(
      best.position.x,
      best.position.y,
      best.position.z
    ),
    kind: "VERTEX",
  };
}
