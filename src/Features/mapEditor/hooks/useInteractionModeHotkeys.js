import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import applyInteractionModeChange from "../utils/applyInteractionModeChange";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { selectSubtractPickAnnotationId } from "../utils/subtractPickMode";

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
// effects (EDIT target clearing) stay identical. Re-pressing the active mode's
// letter clears it back to "no mode" (null), like re-clicking its button.
//
// Like useFreeAnnotationHotkeys, they fire UPSTREAM — only when no draw is
// active (!enabledDrawingMode) — so they never contend with in-draw letters.
export default function useInteractionModeHotkeys() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // Non-advanced mode: the toggle is hidden (PopperMapListings) and the D/M/S
  // hotkeys are disabled below, but other modules still set the mode for their
  // own flows (ZONES arming forces DRAW, exiting the POV framing forces
  // SELECT). Landing back in the Dessin module with that residual mode would
  // silently change the panel behavior — reset it to "no mode" (the default).
  // The ?mode=viewer lock keeps its forced SELECT (read-only shared link).
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);

  useEffect(() => {
    if (advancedLayout) return;
    if (selectedViewerKey !== "MAP") return;
    if (viewerMode) return;
    if (interactionMode == null) return;
    applyInteractionModeChange(dispatch, {
      current: interactionMode,
      next: null,
      selectedItem: store.getState().selection.selectedItems[0] || null,
    });
  }, [
    advancedLayout,
    selectedViewerKey,
    viewerMode,
    interactionMode,
    dispatch,
    store,
  ]);

  useEffect(() => {
    // Only switch modes while not mid-draw.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const next = MODE_BY_KEY[e.key.toLowerCase()];
      if (!next) return;

      const s = store.getState();

      // The panel mode toggle is an advanced-mode affordance (appConfig
      // "Mode avancé") — without it, D/M/S must not switch to an invisible
      // mode (the app stays in "no mode", the default draw-like behavior).
      if (!s.appConfig.advancedLayout) return;

      // Walk mode owns the keyboard (M narrows the spray nozzle there) —
      // registered later on the same capture phase, its
      // stopImmediatePropagation cannot pre-empt this earlier listener.
      if (s.threedEditor.walkMode.active) return;

      // "D" doubles as the global "go to Dessin module" shortcut
      // (useViewerSwitchHotkeys). The DRAW-mode meaning only applies while
      // the Dessin module displays the 2D editor; anywhere else (BASE_MAPS,
      // POV, Dessin's 3D editor, …) the module switch owns the letter —
      // yield so the two capture-phase listeners stay state-disjoint
      // regardless of registration order.
      if (
        next === "DRAW" &&
        (s.viewers.selectedViewerKey !== "MAP" ||
          selectEffectiveViewerKey(s) !== "MAP")
      )
        return;

      // Don't fight modes that own these letters (paste / subtract).
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;

      // The mode is forced read-only (SELECT) by the "Maillage" toggle or the
      // ?mode=viewer lock — the panel toggle is disabled there too, so ignore.
      if (s.annotations.showMeshCells || s.urlParams.viewerMode) return;

      // Re-pressing the active mode's letter clears it back to "no mode".
      const current = s.popperMapListings.interactionMode;
      const target = next === current ? null : next;

      applyInteractionModeChange(dispatch, {
        current,
        next: target,
        selectedItem: s.selection.selectedItems[0] || null,
      });
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store]);
}
