import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { getDrawingToolsByType } from "../constants/drawingTools.jsx";
import buildToolDraft from "../utils/buildToolDraft";

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

// Global shortcut to START an opening (ouverture) draw:
//   - "O" → enter opening mode on the last-used CUT tool, falling back to the
//     first CUT tool (CUT_CLICK, surface clic-clic).
//
// Fires UPSTREAM — only when no draw is active (!enabledDrawingMode), mirroring
// useFreeAnnotationHotkeys (L/S). The in-draw opening letters S/R/L/B + Tab live
// in useDrawingToolHotkeys and only attach while a draw is active, so the two
// systems are disjoint. Mounted once in the live map editor (MainMapEditorV3).
export default function useOpeningHotkey() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    // Only act before any draw has started.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== "o") return;

      // Stay out of the other editor modes that may own this letter
      // (paste mode, subtract mode).
      const s = store.getState();
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;

      const tools = getDrawingToolsByType("CUT");
      if (tools.length === 0) return;
      const selectedKey = s.mapEditor.selectedToolKeyByTemplateId?.CUT;
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
      // Record the active CUT variant so the in-draw Tab / S-R-L-B switching
      // (useDrawingToolHotkeys) and the toolbar highlight track it from the
      // first keypress.
      dispatch(
        setSelectedToolKeyForTemplate({ templateId: "CUT", toolKey: tool.key })
      );
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store]);
}
