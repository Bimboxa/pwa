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
//   5. the point of a scan base map under the cursor (optional `intersectScan`
//      callback, see intersectScene3d) — measuring on a 3D scan
// A vertex / edge lying BEHIND a scan is hidden by it and skipped.
// Returns { position: Vector3, kind: "VERTEX" | "EDGE" | "SCAN", baseMapId? }
// or null when the cursor is over nothing snappable.
export default function computeDimensionSnap({
  mouseNdc,
  camera,
  canvasSize,
  findNearestVertex,
  intersectScan = null,
}) {
  const contourAdjacency = getSectionContourAdjacency();

  const scanHit = intersectScan?.(mouseNdc) ?? null;
  // Same rule as computeSnapTarget: the snap sits up to a few px away from
  // the cursor ray, on a surface seen at an angle.
  const isHiddenByScan = (position) =>
    Boolean(scanHit?.isScan) &&
    camera.position.distanceTo(position) > scanHit.distance * 1.02 + 0.1;

  const contourVertex = findNearestVertexSnapInAdjacency(
    contourAdjacency,
    mouseNdc,
    camera,
    canvasSize
  );
  if (contourVertex?.position && !isHiddenByScan(contourVertex.position)) {
    return { position: contourVertex.position, kind: "VERTEX" };
  }

  const vertexSnap = findNearestVertex(mouseNdc, camera, canvasSize);
  if (vertexSnap?.position && !isHiddenByScan(vertexSnap.position)) {
    return { position: vertexSnap.position, kind: "VERTEX" };
  }

  const contourEdge = findNearestEdgeSnap(
    contourAdjacency,
    mouseNdc,
    camera,
    canvasSize
  );
  if (contourEdge?.position && !isHiddenByScan(contourEdge.position)) {
    return { position: contourEdge.position, kind: "EDGE" };
  }

  const edgeSnap = findNearestEdgeSnap(
    getMeshAdjacency(),
    mouseNdc,
    camera,
    canvasSize
  );
  if (edgeSnap?.position && !isHiddenByScan(edgeSnap.position)) {
    return { position: edgeSnap.position, kind: "EDGE" };
  }

  if (scanHit?.isScan) {
    return {
      position: scanHit.position,
      kind: "SCAN",
      baseMapId: scanHit.baseMapId,
    };
  }

  return null;
}
