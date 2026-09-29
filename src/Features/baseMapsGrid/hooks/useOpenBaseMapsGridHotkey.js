import { useEffect } from "react";
import { useSelector } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import isEditableTarget from "../utils/isEditableTarget";

export const BASE_MAPS_GRID_HOTKEY = "G";

// "G" opens the base maps grid from a displayed 2D map editor (the grid
// closes itself on the same key, see LayerBaseMapsGrid). Same guards as the
// "T" 2D/3D toggle: plain key only, never while typing, never while drawing
// (the in-draw keys belong to the drawing tools).
export default function useOpenBaseMapsGridHotkey({ enabled, onOpen }) {
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const is2dEditorDisplayed =
    effectiveKey === "MAP" || effectiveKey === "BASE_MAPS";

  useEffect(() => {
    if (!enabled || !is2dEditorDisplayed || enabledDrawingMode) {
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== BASE_MAPS_GRID_HOTKEY.toLowerCase()) return;
      // no-op when the grid is already opening / open (see useOpenBaseMapsGrid)
      onOpen?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, is2dEditorDisplayed, enabledDrawingMode, onOpen]);
}
