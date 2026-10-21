import { Vector3 } from "three";

import quantizeVertex from "Features/threedDrawing/utils/quantizeVertex";

// Base map groups owning a mesh vertex at `position` (1mm quantized) — a
// snapped vertex shared by annotations of several base maps (touching
// corners) is ambiguous: the grab click uses this list to prefer the
// SELECTED base map. Same snappable filter as useVertexSnap's buildIndex.
export default function findBaseMapGroupsAtVertex(editor, position) {
  const scene = editor?.sceneManager?.scene;
  if (!scene || !position) return [];

  const targetKey = quantizeVertex(position);
  const byBaseMapId = new Map(); // baseMapId -> group
  const tmp = new Vector3();

  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return;
    if (obj.userData?.isHoverOverlay) return;

    // Owning base map group + snappable / hidden-ancestor filter.
    let isSnappable = false;
    let group = null;
    let parent = obj;
    while (parent) {
      if (parent.visible === false) return;
      if (
        parent.userData?.nodeType === "ANNOTATION" ||
        parent.userData?.isBasemap ||
        parent.userData?.isMesh3d
      ) {
        isSnappable = true;
      }
      if (parent.userData?.kind === "baseMap") group = parent;
      parent = parent.parent;
    }
    if (!isSnappable || !group) return;
    const baseMapId = group.userData?.baseMapId;
    if (!baseMapId || byBaseMapId.has(baseMapId)) return;

    obj.updateWorldMatrix(true, false);
    // Fat lines (Line2) hold INSTANCED geometry: their vertices are the
    // `exportLine` positions of a snap line, like in buildIndex — the plan
    // axis and the placement's inverted T are such lines.
    if (obj.isLine2 || obj.isLineSegments2) {
      const linePositions = obj.userData?.isSnapLine
        ? obj.userData.exportLine?.positions
        : null;
      if (!linePositions) return;
      for (let i = 0; i + 2 < linePositions.length; i += 3) {
        tmp.set(linePositions[i], linePositions[i + 1], linePositions[i + 2]);
        tmp.applyMatrix4(obj.matrixWorld);
        if (quantizeVertex(tmp) === targetKey) {
          byBaseMapId.set(baseMapId, group);
          return;
        }
      }
      return;
    }
    const pos = obj.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      tmp.applyMatrix4(obj.matrixWorld);
      if (quantizeVertex(tmp) === targetKey) {
        byBaseMapId.set(baseMapId, group);
        return;
      }
    }
  });

  return Array.from(byBaseMapId, ([baseMapId, group]) => ({
    baseMapId,
    group,
  }));
}
