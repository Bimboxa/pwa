import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  selectEffectiveViewerKey,
  selectSelectedModuleKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { WALK_MODE_TOGGLE_KEY } from "Features/threedEditor/utils/walkModeToggle";
import { selectSubtractPickAnnotationId } from "../utils/subtractPickMode";
import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";

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
//   - "P" → free surface (POLYGON) — 2D editor only: in the 3D editor P
//     toggles the first-person walk mode (walkModeToggle)
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
      if (s.mapEditor.pasteClipboard || selectSubtractPickAnnotationId(s))
        return;

      // Walk mode owns the keyboard (Q/S/Z/W/R/O/B held or pressed there) —
      // and being registered later on the same capture phase, its
      // stopImmediatePropagation cannot pre-empt this earlier listener.
      if (s.threedEditor.walkMode.active) return;

      const key = e.key.toLowerCase();

      // In the 3D editor P belongs to the walk mode toggle (useWalkMode,
      // also a later capture listener): the free surface yields there, the
      // free line (L) keeps working in both editors.
      if (
        key === WALK_MODE_TOGGLE_KEY &&
        isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
      )
        return;

      // Free-draw letters belong to the Dessin module only ("MAP" in the
      // left band, whichever of its 2D/3D editors is displayed) — in the
      // Viewer / Maillage / Zones / POV modules P and L stay inert.
      if (selectSelectedModuleKey(s) !== "MAP") return;

      // Free-draw letters only start a draw while in the "Dessin" (DRAW)
      // interaction mode or in "no mode" (null), which draws like DRAW. In
      // Modification / Sélection, L/P are inert (D/M/S own the mode switching
      // instead).
      const im = s.popperMapListings.interactionMode;
      if (im !== "DRAW" && im != null) return;

      // The shared ?mode=viewer lock is read-only — never start a draw there,
      // even if some future path resets interactionMode to DRAW.
      if (s.urlParams.viewerMode) return;

      // While the docked Dessin panel shows a template detail view, the
      // letters belong to the pre-draw template shortcuts
      // (ToolbarStartDrawTemplate) — "L" arms that template's Ligne tool,
      // not a free annotation.
      if (s.leftPanel.leftPanelDocked && s.panelDrawing.detailTemplateId)
        return;

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
      // Tools of the displayed editor: a remembered « Pinceau » re-arms in
      // the Dessin 3D editor, falls back to a drawing tool elsewhere.
      const activeTool = resolveActiveToolForTemplate(
        template,
        selectedToolKey,
        { editor: selectDrawingToolsEditor(store.getState()) }
      );
      if (!activeTool) return;

      const rememberedProps =
        store.getState().mapEditor.draftPropsByTemplateId?.[template.id];
      startDrawFromTemplate(dispatch, {
        template,
        listingId,
        activeTool,
        rememberedProps,
      });
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
