import { Vector3 } from "three";

import {
  MESH3D_EDGE_HOVER_WIDTH_PX,
  MESH3D_PART_HOVER_COLOR,
} from "Features/annotationMesh3d/constants/mesh3dPartColors";
import { buildMesh3dEdgeLines } from "Features/annotationMesh3d/services/pickMesh3dEdge";
import { buildStippleOverlayFromPositions } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { isSegmentDisplayed } from "Features/meshPaint/utils/clipPaintGeometry";

// Hover feedback of a painted part (plain hover of the 3D editor, not the
// « Pinceau »): the same look as the parts of a mesh annotation —
//   - EDGE: thick neon-green screen-space line over the displayed segments,
//     added to the scene in world coordinates;
//   - FACE: the blue hover stipple over the paint's front skin
//     (userData.hoverPositions, ThreedMeshPaints), child of the paint mesh.
// Returns { object, dispose } or null; dispose() detaches and frees it.
export default function buildMeshPaintHoverHelper(paintObject, { domElement }) {
  const userData = paintObject?.userData;
  if (!userData) return null;

  if (userData.partType === MESH_PAINT_PART_TYPES.EDGE) {
    const points = userData.localGeometry?.points ?? [];
    if (points.length < 2) return null;
    paintObject.updateWorldMatrix(true, false);
    const clip = userData.clip ?? null;
    const positions = [];
    const v = new Vector3();
    for (let i = 0; i + 1 < points.length; i++) {
      if (!isSegmentDisplayed(points[i], points[i + 1], clip)) continue;
      for (const p of [points[i], points[i + 1]]) {
        v.set(p.x, p.y, p.z).applyMatrix4(paintObject.matrixWorld);
        positions.push(v.x, v.y, v.z);
      }
    }
    if (positions.length < 6) return null;
    const line = buildMesh3dEdgeLines(positions, {
      color: MESH3D_PART_HOVER_COLOR,
      linewidth: MESH3D_EDGE_HOVER_WIDTH_PX,
      domElement,
    });
    return {
      object: line,
      attach: (scene) => scene.add(line),
      dispose: () => {
        line.parent?.remove(line);
        line.geometry?.dispose?.();
        line.material?.dispose?.();
      },
    };
  }

  if (userData.partType === MESH_PAINT_PART_TYPES.FACE) {
    const positions = userData.hoverPositions;
    if (!positions?.length) return null;
    const overlay = buildStippleOverlayFromPositions(
      Float32Array.from(positions)
    );
    if (!overlay) return null;
    return {
      object: overlay,
      attach: () => paintObject.add(overlay),
      dispose: () => {
        overlay.parent?.remove(overlay);
        overlay.geometry?.dispose?.();
        overlay.material?.dispose?.();
      },
    };
  }

  return null;
}
