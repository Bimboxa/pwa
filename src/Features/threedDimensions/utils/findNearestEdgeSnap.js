import { Vector3, Vector4 } from "three";

const _clip = new Vector4();

// Clip-space w of a world point: the perspective divisor (1 for an
// orthographic camera).
function getClipW(position, camera) {
  _clip
    .set(position.x, position.y, position.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix);
  return _clip.w;
}

// Find the closest point lying ON a mesh edge (segment) to the cursor, in
// screen space. Reuses the vertex-adjacency map published in `meshGraphStore`
// by useVertexSnap (shape: Map<key, { position: Vector3, neighbors: Set<key> }>).
//
// Each unique edge (A-B) is projected to pixels; the closest point on the 2D
// segment to the cursor is found via the clamped projection parameter `t`.
// `t` is a SCREEN parameter: under a perspective camera the world point is
// A + s (B - A) with s = t wA / ((1 - t) wB + t wA) (w = clip-space w of
// each end) — a plain A.lerp(B, t) drifts towards the far end of an edge
// running away from the camera, off the cursor.
//
// options.accept(position): a candidate point is kept only when it returns
// true (e.g. not hidden behind the surface under the cursor) — the next
// closest edge then takes over.
//
// Returns `{ position: Vector3, kind: "EDGE", edge: [Vector3, Vector3],
// nodeId? }` or null when no edge is within `pixelThreshold` — `edge` is the
// snapped segment (world), `nodeId` the annotation owning it (both ends),
// when there is one.
export default function findNearestEdgeSnap(
  adjacency,
  mouseNdc,
  camera,
  canvasSize,
  pixelThreshold = 12,
  options = {}
) {
  if (!adjacency || adjacency.size === 0 || !camera || !canvasSize) return null;
  const accept = options.accept ?? null;

  const halfW = canvasSize.width / 2;
  const halfH = canvasSize.height / 2;
  const mouseX = mouseNdc.x * halfW;
  const mouseY = mouseNdc.y * halfH;

  const pa = new Vector3();
  const pb = new Vector3();

  let best = null;
  let bestNodes = null;
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
      if (d2 >= bestSq) continue;

      const wA = getClipW(nodeA.position, camera);
      const wB = getClipW(nodeB.position, camera);
      const denom = (1 - t) * wB + t * wA;
      const s = Math.abs(denom) > 1e-12 ? (t * wA) / denom : t;
      const position = nodeA.position.clone().lerp(nodeB.position, s);
      if (accept && !accept(position)) continue;

      bestSq = d2;
      best = position;
      bestNodes = [nodeA, nodeB];
    }
  }

  if (!best) return null;
  let nodeId;
  for (const id of bestNodes[0].nodeIds ?? []) {
    if (bestNodes[1].nodeIds?.has(id)) {
      nodeId = id;
      break;
    }
  }
  return {
    position: best,
    kind: "EDGE",
    edge: [bestNodes[0].position.clone(), bestNodes[1].position.clone()],
    nodeId,
  };
}
