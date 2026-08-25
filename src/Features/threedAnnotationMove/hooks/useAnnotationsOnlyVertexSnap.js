import { useCallback, useEffect, useRef } from "react";

import { useSelector } from "react-redux";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";

// Annotations-only variant of useVertexSnap for the grab/pivot phase of the
// annotation move/rotate tools: the first click must land on annotation
// geometry (no base map planes, no mailles). Does not publish to
// meshGraphStore — the global adjacency stays owned by useVertexSnap.
export default function useAnnotationsOnlyVertexSnap({ active }) {
  const indexRef = useRef([]);
  const snapIndexEpoch = useSelector(
    (s) => s.threedEditor.drawingMode.snapIndexEpoch
  );

  useEffect(() => {
    if (!active) {
      indexRef.current = [];
      return;
    }
    const editor = getActiveThreedEditor();
    const { verts } = buildIndex(editor?.sceneManager?.scene, {
      annotationsOnly: true,
    });
    indexRef.current = verts;
    return () => {
      indexRef.current = [];
    };
  }, [active, snapIndexEpoch]);

  const findNearestSnap = useCallback(
    (mouseNdc, camera, canvasSize, pixelThreshold = 12) =>
      findNearestVertexInVerts(
        indexRef.current,
        mouseNdc,
        camera,
        canvasSize,
        pixelThreshold
      ),
    []
  );

  return { findNearestSnap };
}
