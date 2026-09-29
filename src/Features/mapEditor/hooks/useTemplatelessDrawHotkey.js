import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { selectSubtractPickAnnotationId } from "../utils/subtractPickMode";
import startTemplatelessDraw from "../utils/startTemplatelessDraw";

const HOTKEY = "d";

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

// Global shortcut to START a templateless draw ("Dessin" tool row):
//   - "d" → draw the last-used annotation type (default: surface), with no
//     annotation template nor listing.
//
// Fires UPSTREAM — only when no draw is active (!enabledDrawingMode), like
// useToolGroupHotkey. Once a draw runs, "d" keeps its in-draw meanings
// (smart-detect loupe, segment direction — InteractionLayer). Registered on
// the capture phase: it pre-empts the loupe while no draw is active.
export default function useTemplatelessDrawHotkey() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    // Only act before any draw has started.
    if (enabledDrawingMode) return undefined;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key.toLowerCase() !== HOTKEY) return;

      const s = store.getState();
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;

      // Only start a draw while the Dessin module displays the 2D editor
      // (same guard as useToolGroupHotkey).
      if (s.viewers.selectedViewerKey !== "MAP") return;
      if (selectEffectiveViewerKey(s) !== "MAP") return;

      // Same rule as the free-draw letters: DRAW interaction mode or "no
      // mode" only, never in the shared read-only viewer.
      const im = s.popperMapListings.interactionMode;
      if (im !== "DRAW" && im != null) return;
      if (s.urlParams.viewerMode) return;

      // Templateless annotations belong to a scope.
      if (!s.scopes.selectedScopeId) return;

      // The docked panel's template detail view owns the plain letters.
      if (s.leftPanel.leftPanelDocked && s.panelDrawing.detailTemplateId)
        return;

      startTemplatelessDraw(dispatch, s);
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store]);
}
