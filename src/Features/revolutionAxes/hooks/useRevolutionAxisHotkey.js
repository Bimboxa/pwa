import { useEffect } from "react";
import { useSelector, useStore } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import useStartRevolutionAxisTools from "./useStartRevolutionAxisTools";

const HOTKEY = "a";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Global shortcut to START the drawing of a revolution axis ("Axe de
// révolution" tool row): "a" → draw a new axis on the current plan, or — in
// the Dessin module's 3D editor — on a horizontal base map plane of the scene
// (the same 2D state is bridged into revolutionAxisDrawMode, see
// useRevolutionAxisDrawThreedBridge).
//
// Same contract as useToolGroupHotkey: fires UPSTREAM only (no draw armed —
// once a draw runs, "a" keeps its in-draw meanings), in the Dessin module, on
// the capture phase. One shortcut for both editors: MainMapEditorV3 (which
// mounts this hook) stays mounted while the module shows its 3D editor. In 2D,
// HORIZONTAL base maps only: on a vertical one an axis is not drawn but
// dropped, which needs the row (axis choice). In 3D the main base map's
// orientation is irrelevant (the clicks pick a horizontal plane).
export default function useRevolutionAxisHotkey() {
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const baseMap = useMainBaseMap();
  const isVertical = baseMap?.orientation === "VERTICAL";
  const { startDrawAxis } = useStartRevolutionAxisTools();

  useEffect(() => {
    // Only act before any draw has started.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== HOTKEY) return;

      // Stay out of the other editor modes that own this letter (paste mode:
      // pattern detection, subtract mode, smart detect).
      const s = store.getState();
      if (
        s.mapEditor.pasteClipboard ||
        selectSubtractPickAnnotationId(s) ||
        s.mapEditor.smartDetectEnabled
      )
        return;

      // Dessin module only (the editor stays mounted under every module), in
      // its 2D editor or toggled to 3D.
      if (s.viewers.selectedViewerKey !== "MAP") return;
      const editorKey = selectEffectiveViewerKey(s);
      const isThreedEditor = isThreedFamilyViewerKey(editorKey);
      if (editorKey !== "MAP" && !isThreedEditor) return;
      // 2D: a vertical base map drops an axis instead of drawing one.
      if (!isThreedEditor && isVertical) return;
      // Walk mode owns the keyboard.
      if (isThreedEditor && s.threedEditor.walkMode.active) return;

      // Docked panel on a template detail view: the tool rows are not on
      // screen and the letters belong to the pre-draw template shortcuts.
      if (s.leftPanel.leftPanelDocked && s.panelDrawing.detailTemplateId)
        return;

      startDrawAxis();
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
    // startDrawAxis only wraps dispatch: not a dependency.
  }, [enabledDrawingMode, isVertical, store]);
}
