import { useCallback, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import applyAnnotationMaterialState, {
  STATE_DIM,
  STATE_NONE,
} from "Features/threedEditor/js/utilsAnnotationsManager/applyAnnotationMaterialState";

// Owns the selection-driven dim state for the 3D viewer. Lives as a child of
// MainThreedEditor so that re-renders triggered by selection changes do NOT
// re-render MainThreedEditor itself — re-rendering the parent re-fires
// `useAutoLoadAnnotationsInThreedEditor` which destroys + recreates every
// annotation object (same trap as ThreedHoverTooltip).
//
// State machine per annotation (selection wins over hover — selected
// annotations always show their original material, even while hovered):
//   - in selection                             → STATE_NONE  (original)
//   - hovered (and not selected)               → STATE_NONE  (original — the
//     hover highlight is the face-level stipple overlay, not a recolor)
//   - dimmed by solo (not in the soloed set)   → STATE_DIM   (grey, translucent)
//   - selection non-empty (and not selected)   → STATE_DIM   (grey, opacity 0.6)
//   - otherwise                                → STATE_NONE  (original)
//
// `hoveredIdRef` is read at the moment we apply state so the dimmer doesn't
// fight with the inline hover handler in MainThreedEditor.

export default function ThreedSelectionDimmer({
  threedEditorRef,
  hoveredIdRef,
}) {
  const selectedItems = useSelector((s) => s.selection.selectedItems);
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const mainBaseMapId = mainBaseMap?.id ?? null;

  const selectedIdsRef = useRef([]);
  selectedIdsRef.current = selectedItems
    .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
    .map((i) => i.nodeId || i.id);

  // Read latest per-basemap modes / main id at apply time so the
  // subscribe-on-ready path (async GLB loads) also picks up current settings.
  const annotationsModeRef = useRef(annotationsModeByBaseMapId);
  annotationsModeRef.current = annotationsModeByBaseMapId;
  const mainBaseMapIdRef = useRef(mainBaseMapId);
  mainBaseMapIdRef.current = mainBaseMapId;

  const computeAndApply = useCallback(
    (id) => {
      const editor = threedEditorRef.current;
      if (!editor) return;
      const manager = editor.sceneManager?.annotationsManager;
      if (!manager) return;
      const obj = manager.annotationsObjectsMap?.[id];
      if (!obj) return;
      const selectedIds = selectedIdsRef.current;
      const hoveredId = hoveredIdRef?.current ?? null;

      // Annotations belonging to a non-main basemap set to "DIMMED" render
      // grey-translucent regardless of the current selection.
      const bmId = obj.userData?.baseMapId ?? null;
      const isMain = bmId === mainBaseMapIdRef.current;
      const mode = isMain
        ? "NORMAL"
        : (annotationsModeRef.current?.[bmId] ?? "NONE");

      // Solo (3D): non-soloed annotations are tagged `soloDimmed` by
      // useAnnotationsV2 (which the 3D viewer keeps instead of hiding them) so
      // the soloed template stays in its original material and the rest go
      // translucent.
      const isSoloDimmed = obj.userData?.soloDimmed === true;

      let state;
      if (selectedIds.includes(id)) state = STATE_NONE;
      else if (id === hoveredId) state = STATE_NONE;
      else if (!isMain && mode === "DIMMED") state = STATE_DIM;
      else if (isSoloDimmed) state = STATE_DIM;
      else if (selectedIds.length > 0) state = STATE_DIM;
      else state = STATE_NONE;
      applyAnnotationMaterialState(obj, state);
    },
    [threedEditorRef, hoveredIdRef]
  );

  // Apply state to every existing annotation when the selection — or the
  // per-basemap annotation mode / main basemap — changes.
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor) return;
    const manager = editor.sceneManager?.annotationsManager;
    if (!manager) return;
    const ids = Object.keys(manager.annotationsObjectsMap || {});
    ids.forEach(computeAndApply);
    editor.renderScene?.();
  }, [
    selectedItems,
    annotationsModeByBaseMapId,
    mainBaseMapId,
    computeAndApply,
    threedEditorRef,
  ]);

  // Re-apply state to a single annotation when its 3D object is (re)created
  // or finishes its async GLB load. Without this, GLBs that load after a
  // selection change would render with their original material instead of dim.
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor) return;
    const manager = editor.sceneManager?.annotationsManager;
    if (!manager?.subscribeAnnotationReady) return;
    return manager.subscribeAnnotationReady((id) => {
      computeAndApply(id);
      editor.renderScene?.();
    });
  }, [computeAndApply, threedEditorRef]);

  return null;
}
