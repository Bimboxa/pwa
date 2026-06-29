import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import useFreeAnnotationTemplates from "./useFreeAnnotationTemplates";
import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "../utils/startDrawFromTemplate";
import { getFreeAnnotationShortcut } from "../constants/freeAnnotationShortcuts";

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

// Global shortcuts to START a free draw (letters from freeAnnotationShortcuts):
//   - "L" → free line (POLYLINE)
//   - "S" → free surface (POLYGON)
//
// These fire UPSTREAM — only when no draw is active (!enabledDrawingMode). The
// in-draw tool-selection letters in useDrawingToolHotkeys only attach while a
// draw is active, so the two hotkey systems are strictly disjoint and never
// contend for the same keypress (even though "L" appears in both).
export default function useFreeAnnotationHotkeys() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const { listingId, lineTemplate, surfaceTemplate } =
    useFreeAnnotationTemplates();

  useEffect(() => {
    // Only act before any draw has started.
    if (enabledDrawingMode) return undefined;
    if (!lineTemplate && !surfaceTemplate) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      // Stay out of the other editor modes that may own these letters
      // (paste mode, subtract mode).
      const s = store.getState();
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;

      const key = e.key.toLowerCase();
      let template = null;
      if (key === getFreeAnnotationShortcut(lineTemplate)?.toLowerCase())
        template = lineTemplate;
      else if (
        key === getFreeAnnotationShortcut(surfaceTemplate)?.toLowerCase()
      )
        template = surfaceTemplate;
      if (!template) return;

      const selectedToolKey =
        store.getState().mapEditor.selectedToolKeyByTemplateId[template.id];
      const activeTool = resolveActiveToolForTemplate(
        template,
        selectedToolKey
      );
      if (!activeTool) return;

      startDrawFromTemplate(dispatch, { template, listingId, activeTool });
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    enabledDrawingMode,
    lineTemplate,
    surfaceTemplate,
    listingId,
    dispatch,
    store,
  ]);
}
