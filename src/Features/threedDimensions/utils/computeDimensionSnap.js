import { getMeshAdjacency } from "Features/threedDrawing/services/meshGraphStore";

import findNearestEdgeSnap from "./findNearestEdgeSnap";

// Compute the snap target for the dimension ("cote") tool at the current
// cursor position. Only mesh geometry snaps are allowed (no free point):
//   1. nearest mesh vertex (within pixel threshold)
//   2. nearest point on a mesh edge/segment (within pixel threshold)
// Returns { position: Vector3, kind: "VERTEX" | "EDGE" } or null when the
// cursor is over nothing snappable.
export default function computeDimensionSnap({
  mouseNdc,
  camera,
  canvasSize,
  findNearestVertex,
}) {
  const vertexSnap = findNearestVertex(mouseNdc, camera, canvasSize);
  if (vertexSnap?.position) {
    return { position: vertexSnap.position, kind: "VERTEX" };
  }

  const edgeSnap = findNearestEdgeSnap(
    getMeshAdjacency(),
    mouseNdc,
    camera,
    canvasSize
  );
  if (edgeSnap?.position) {
    return { position: edgeSnap.position, kind: "EDGE" };
  }

  return null;
}
