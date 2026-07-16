import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { getDrawingToolsByType } from "../constants/drawingTools.jsx";
import buildToolDraft from "../utils/buildToolDraft";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

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

// Generic global shortcut to START a draw for a tool group (templateId):
//   - pressing `hotkey` → enter the group's last-used tool, falling back to the
//     first tool in the group.
//
// Fires UPSTREAM — only when no draw is active (!enabledDrawingMode), mirroring
// useFreeAnnotationHotkeys (L/S). The in-draw variant letters (Tab, S/R/L/B for
// CUT) live in useDrawingToolHotkeys and only attach while a draw is active, so
// the two systems are disjoint. Mounted once per binding in the live map editor
// (MainMapEditorV3): "o" → CUT (openings), "x" → SPLIT_LINE (Retirer un
// segment), "c" → SPLIT_POLYLINE_CLICK (Couper un segment).
export default function useToolGroupHotkey(hotkey, templateId) {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    // Only act before any draw has started.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== hotkey.toLowerCase()) return;

      // Stay out of the other editor modes that may own this letter
      // (paste mode, subtract mode).
      const s = store.getState();
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;

      // Only start a draw while the Dessin module displays the 2D editor.
      // The editor is kept mounted under every module, so without this guard
      // a keypress in another module (or in Dessin's 3D editor) would start
      // an invisible draw — and "c" doubles as the global "go to Carnet de
      // plans" shortcut (useViewerSwitchHotkeys), which owns the letter
      // outside the MAP module.
      if (s.viewers.selectedViewerKey !== "MAP") return;
      if (selectEffectiveViewerKey(s) !== "MAP") return;

      const tools = getDrawingToolsByType(templateId);
      if (tools.length === 0) return;
      const selectedKey = s.mapEditor.selectedToolKeyByTemplateId?.[templateId];
      const tool =
        (selectedKey && tools.find((t) => t.key === selectedKey)) || tools[0];
      if (!tool) return;

      const newAnnotation = s.annotations.newAnnotation ?? {};
      const openingDefaults = {
        strokeWidth: s.mapEditor.openingStrokeWidth,
        strokeWidthUnit: s.mapEditor.openingStrokeWidthUnit,
      };

      dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
      dispatch(
        setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults))
      );
      // Record the active variant so the in-draw Tab / letter switching
      // (useDrawingToolHotkeys) and the toolbar highlight track it from the
      // first keypress.
      dispatch(
        setSelectedToolKeyForTemplate({ templateId, toolKey: tool.key })
      );
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store, hotkey, templateId]);
}
