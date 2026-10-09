import { useEffect } from "react";

import isEditableTarget from "Features/baseMapsGrid/utils/isEditableTarget";

export const ZOOM_OUT_HOTKEY = "Z";

// "Z" fires the zoom out of the displayed editor (2D: ButtonZoomOutMap, 3D:
// ButtonZoomOutThreed, base maps grid: its "Tout afficher" button). Same
// guards as the "G" of the base maps grid: plain key only (Ctrl/Cmd+Z stays
// the undo), never while typing. `enabled` carries the per-editor gates —
// the in-draw "Z" of the 2D tools ("Offset par défaut") and of the 3D
// rectangle (dimension key) and the walk mode keyboard must keep the key.
export default function useZoomOutHotkey({ enabled, onZoomOut }) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== ZOOM_OUT_HOTKEY.toLowerCase()) return;
      e.preventDefault();
      onZoomOut?.();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onZoomOut]);
}
