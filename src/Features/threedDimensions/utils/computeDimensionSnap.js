import { getMeshAdjacency } from "Features/threedDrawing/services/meshGraphStore";

import { getSectionContourAdjacency } from "../services/sectionContourSnapStore";
import findNearestEdgeSnap from "./findNearestEdgeSnap";
import findNearestVertexSnapInAdjacency from "./findNearestVertexSnapInAdjacency";

// Compute the snap target for the dimension ("cote") tool at the current
// cursor position. Only geometry snaps are allowed (no free point). The cut
// contour (clipping plane ∩ shapes) takes priority over the full mesh, so the
// user measures on the section first:
//   1. nearest cut-contour vertex
//   2. nearest mesh vertex
//   3. nearest point on a cut-contour edge
//   4. nearest point on a mesh edge
// Returns { position: Vector3, kind: "VERTEX" | "EDGE" } or null when the
// cursor is over nothing snappable.
export default function computeDimensionSnap({
  mouseNdc,
  camera,
  canvasSize,
  findNearestVertex,
}) {
  const contourAdjacency = getSectionContourAdjacency();

  const contourVertex = findNearestVertexSnapInAdjacency(
    contourAdjacency,
    mouseNdc,
    camera,
    canvasSize
  );
  if (contourVertex?.position) {
    return { position: contourVertex.position, kind: "VERTEX" };
  }

  const vertexSnap = findNearestVertex(mouseNdc, camera, canvasSize);
  if (vertexSnap?.position) {
    return { position: vertexSnap.position, kind: "VERTEX" };
  }

  const contourEdge = findNearestEdgeSnap(
    contourAdjacency,
    mouseNdc,
    camera,
    canvasSize
  );
  if (contourEdge?.position) {
    return { position: contourEdge.position, kind: "EDGE" };
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
