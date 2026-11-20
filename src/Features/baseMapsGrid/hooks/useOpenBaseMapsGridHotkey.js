import { useEffect } from "react";
import { useSelector } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";

import isEditableTarget from "../utils/isEditableTarget";

export const BASE_MAPS_GRID_HOTKEY = "G";

// "G" toggles the base maps grid of a displayed 2D map editor (single
// listener for the opening and the closing, see ButtonOpenBaseMapsGrid). Same guards as the
// "T" 2D/3D toggle: plain key only, never while typing, never while drawing
// (the in-draw keys belong to the drawing tools).
export default function useOpenBaseMapsGridHotkey({ enabled, onToggle }) {
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // The PDF editor layer covers the editor: no grid underneath it.
  const pdfEditorOpen = useSelector(selectPdfEditorOpen);

  const is2dEditorDisplayed =
    effectiveKey === "MAP" || effectiveKey === "BASE_MAPS";

  useEffect(() => {
    if (
      !enabled ||
      !is2dEditorDisplayed ||
      enabledDrawingMode ||
      pdfEditorOpen
    ) {
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== BASE_MAPS_GRID_HOTKEY.toLowerCase()) return;
      // no-op during the opening / closing transitions
      onToggle?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    is2dEditorDisplayed,
    enabledDrawingMode,
    pdfEditorOpen,
    onToggle,
  ]);
}
