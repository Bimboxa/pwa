import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import applyInteractionModeChange from "../utils/applyInteractionModeChange";

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

// Letter → interaction mode. Mirrors the panel ToggleButtonGroup labels:
//   "d" → Dessin (DRAW)  "m" → Modification (EDIT)  "s" → Sélection (SELECT)
const MODE_BY_KEY = {
  d: "DRAW",
  m: "EDIT",
  s: "SELECT",
};

// Global shortcuts to switch the editor interaction mode (D/M/S). They mirror
// the panel ToggleButtonGroup and reuse applyInteractionModeChange so the side
// effects (solo mode, EDIT target clearing) stay identical.
//
// Like useFreeAnnotationHotkeys, they fire UPSTREAM — only when no draw is
// active (!enabledDrawingMode) — so they never contend with in-draw letters.
export default function useInteractionModeHotkeys() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    // Only switch modes while not mid-draw.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const next = MODE_BY_KEY[e.key.toLowerCase()];
      if (!next) return;

      const s = store.getState();

      // "D" doubles as the global "go to Dessin viewer" shortcut
      // (useViewerSwitchHotkeys). The DRAW-mode meaning only applies while the
      // Dessin viewer is already displayed; anywhere else (BASE_MAPS, POV, …)
      // the viewer switch owns the letter — yield so the two capture-phase
      // listeners stay state-disjoint regardless of registration order.
      if (next === "DRAW" && s.viewers.selectedViewerKey !== "MAP") return;

      // Don't fight modes that own these letters (paste / subtract).
      if (s.mapEditor.pasteClipboard || s.mapEditor.subtractSourceAnnotationId)
        return;

      // The mode is forced read-only (SELECT) by the "Maillage" toggle or the
      // ?mode=viewer lock — the panel toggle is disabled there too, so ignore.
      if (s.annotations.showMeshCells || s.urlParams.viewerMode) return;

      const current = s.popperMapListings.interactionMode;
      if (next === current) return;

      applyInteractionModeChange(dispatch, {
        current,
        next,
        selectedItem: s.selection.selectedItems[0] || null,
      });
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store]);
}
