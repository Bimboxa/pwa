import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
  clearDrawingPolylinePoints,
  clearDrawingRectanglePoints,
  clearDrawingSegmentPoints,
  clearRectDims,
  clearConstraintBuffer,
  setRectHasFirstPoint,
} from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";
import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";

import {
  getDrawingToolsByShape,
  getDrawingToolsByType,
} from "../constants/drawingTools.jsx";
import {
  DRAWING_TOOL_HOTKEYS,
  FACE_CUT_TOOL_HOTKEYS,
  OPENING_TOOL_HOTKEYS,
} from "../constants/drawingToolHotkeys";
import buildToolDraft from "../utils/buildToolDraft";
import { getDraftSessionKey } from "Features/annotations/utils/templatelessAnnotations";
import {
  SURFACE_CUT_TOOL_TYPE,
  isSurfaceCutDraft,
} from "Features/surfaceCut/utils/surfaceCutTools";
import {
  FACE_CUT_TOOL_TYPE,
  isFaceCutDrawingMode,
} from "Features/threedFaceCut/utils/faceCutTools";
import { cancelInProgressPolyline } from "Features/threedEditor/threedEditorSlice";

// Keyboard shortcuts to switch the active drawing tool without leaving the
// drawing flow:
//   - Tab / Shift+Tab : cycle next / previous tool within the current shape
//     group (allowed any time a tool is active).
//   - R / L / C / G    : direct-access to a tool by behavior, but ONLY while no
//     first point has been placed yet (so the in-drawing letter shortcuts keep
//     priority once the object has started).
//   - "Coupe face" (FACE_CUT, 3D editor): Tab cycles its tools, K / L / R /
//     H / V jump to one (FACE_CUT_TOOL_HOTKEYS) before the first point.
//
// Mounted once in the live map editor (MainMapEditorV3). Reads live state from
// the store inside the handler so the listener can stay registered for the
// component's lifetime without re-subscribing on every state change.
export default function useDrawingToolHotkeys() {
  const dispatch = useDispatch();
  const store = useStore();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  useEffect(() => {
    if (!enabledDrawingMode) return undefined;

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

    const switchTool = (tool, { isOpening, groupType } = {}) => {
      const s = store.getState();
      const newAnnotation = s.annotations.newAnnotation ?? {};
      const openingDefaults = {
        strokeWidth: s.mapEditor.openingStrokeWidth,
        strokeWidthUnit: s.mapEditor.openingStrokeWidthUnit,
      };
      // Opening tools live in the "CUT" tool group; persist the active variant
      // under that group id so the toolbar highlight tracks it.
      // Templateless drafts ("Dessin" tool) are keyed per annotation type.
      // Other tool groups pass their own id (groupType).
      const templateId =
        groupType ?? (isOpening ? "CUT" : getDraftSessionKey(newAnnotation));
      if (templateId) {
        dispatch(
          setSelectedToolKeyForTemplate({ templateId, toolKey: tool.key })
        );
      }
      // A tool without annotation type (« Pinceau ») keeps the draft as is —
      // the template's type; ToolbarDrawingDraft.handleToolChange parity.
      if (tool.annotationType) {
        dispatch(
          setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults))
        );
      }
      dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
      // Start the new tool from a clean geometry (no-op before the first point,
      // needed when cycling mid-shape via Tab).
      dispatch(clearDrawingPolylinePoints());
      dispatch(clearDrawingRectanglePoints());
      dispatch(clearDrawingSegmentPoints());
      dispatch(clearRectDims());
      dispatch(clearConstraintBuffer());
      dispatch(setRectHasFirstPoint(false));
      // The 3D path in progress belongs to the previous tool too.
      if (groupType === FACE_CUT_TOOL_TYPE) {
        dispatch(cancelInProgressPolyline());
      }
    };

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const s = store.getState();
      // The PDF editor layer covers the editor: keep the armed tool as is.
      if (selectPdfEditorOpen(s)) return;
      const mode = s.mapEditor.enabledDrawingMode;
      if (!mode) return;

      const hasFirstPoint =
        s.mapEditor.drawingPolylinePoints.length > 0 ||
        s.mapEditor.drawingRectanglePoints.length > 0 ||
        s.mapEditor.drawingSegmentPoints.length > 0 ||
        s.mapEditor.rectHasFirstPoint ||
        // V3 CLICK/STRIP/POLYLINE points live in InteractionLayer's local state
        // (useDrawingCommit), mirrored here as a boolean.
        s.mapEditor.drawingHasFirstPoint;

      // Opening (ouverture) tools form their own group (DRAWING_TOOLS_BY_TYPE.CUT)
      // rather than a drawing-shape group, so they get a dedicated branch:
      // Tab cycles all CUT variants, S/R/L/B jump to a specific one.
      const newAnnotation = s.annotations.newAnnotation;
      // Template-driven OPENING drafts (drawingShape "OPENING") are NOT part
      // of the CUT tool group — their S/R keys are handled by the
      // OPENING_SEGMENT mode in InteractionLayer.
      const isOpening =
        (newAnnotation?.type === "CUT" || newAnnotation?.isOpening === true) &&
        newAnnotation?.drawingShape !== "OPENING";
      if (isOpening) {
        const openingTools = getDrawingToolsByType("CUT");
        if (openingTools.length === 0) return;
        const currentKey = s.mapEditor.selectedToolKeyByTemplateId?.CUT;

        // Tab / Shift+Tab — cycle through every CUT variant.
        if (e.key === "Tab") {
          if (openingTools.length < 2) {
            e.preventDefault();
            return;
          }
          const idx = openingTools.findIndex((t) => t.key === currentKey);
          const start = idx === -1 ? 0 : idx;
          const next =
            openingTools[
              (start + (e.shiftKey ? -1 : 1) + openingTools.length) %
                openingTools.length
            ];
          if (next && next.key !== currentKey)
            switchTool(next, { isOpening: true });
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

        // Letters — direct access, only before the first point is placed.
        const toolKey = OPENING_TOOL_HOTKEYS[e.key.toLowerCase()];
        if (!toolKey) return;
        if (hasFirstPoint) return;
        const openingTool = openingTools.find((t) => t.key === toolKey);
        if (!openingTool) return;
        if (openingTool.key !== currentKey)
          switchTool(openingTool, { isOpening: true });
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // « Couper une surface » group (segment / polyline): Tab alternates
      // them; no letter (the draft has no drawing shape).
      if (isSurfaceCutDraft(newAnnotation)) {
        if (e.key !== "Tab") return;
        const cutTools = getDrawingToolsByType(SURFACE_CUT_TOOL_TYPE);
        const currentKey =
          s.mapEditor.selectedToolKeyByTemplateId?.[SURFACE_CUT_TOOL_TYPE] ??
          cutTools[0]?.key;
        const idx = Math.max(
          0,
          cutTools.findIndex((t) => t.key === currentKey)
        );
        const next =
          cutTools[
            (idx + (e.shiftKey ? -1 : 1) + cutTools.length) % cutTools.length
          ];
        if (next && next.key !== currentKey) {
          switchTool(next, { groupType: SURFACE_CUT_TOOL_TYPE });
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // "Coupe face" group (3D editor): Tab cycles its five tools, the
      // letters jump to one before the first point (the 3D path in progress
      // lives in threedEditor, the rectangle anchor in rectHasFirstPoint).
      if (isFaceCutDrawingMode(mode)) {
        const faceCutTools = getDrawingToolsByType(FACE_CUT_TOOL_TYPE);
        if (faceCutTools.length === 0) return;
        const currentKey =
          s.mapEditor.selectedToolKeyByTemplateId?.[FACE_CUT_TOOL_TYPE] ?? mode;
        const hasThreedFirstPoint =
          s.threedEditor.drawingMode.inProgressPolyline.length > 0 ||
          s.mapEditor.rectHasFirstPoint;
        if (e.key === "Tab") {
          const idx = Math.max(
            0,
            faceCutTools.findIndex((t) => t.key === currentKey)
          );
          const next =
            faceCutTools[
              (idx + (e.shiftKey ? -1 : 1) + faceCutTools.length) %
                faceCutTools.length
            ];
          if (next && next.key !== currentKey) {
            switchTool(next, { groupType: FACE_CUT_TOOL_TYPE });
          }
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        const toolKey = FACE_CUT_TOOL_HOTKEYS[e.key.toLowerCase()];
        if (!toolKey) return;
        if (hasThreedFirstPoint) return;
        const faceCutTool = faceCutTools.find((t) => t.key === toolKey);
        if (!faceCutTool) return;
        if (faceCutTool.key !== currentKey) {
          switchTool(faceCutTool, { groupType: FACE_CUT_TOOL_TYPE });
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      const drawingShape = s.annotations.newAnnotation?.drawingShape;
      if (!drawingShape) return;
      // The group of the editor shown (the 3D-only « Pinceau » in the Dessin
      // module's 3D editor — this hook stays mounted under it), minus the
      // tools needing a template for a template-less draft.
      const tools = getDrawingToolsByShape(drawingShape, {
        editor: selectDrawingToolsEditor(s),
        templateless: !s.annotations.newAnnotation?.annotationTemplateId,
      });
      if (tools.length === 0) return;

      // Tab / Shift+Tab — cycle through the group.
      if (e.key === "Tab") {
        if (tools.length < 2) {
          e.preventDefault();
          return;
        }
        const idx = tools.findIndex((t) => t.key === mode);
        const start = idx === -1 ? 0 : idx;
        const next =
          tools[(start + (e.shiftKey ? -1 : 1) + tools.length) % tools.length];
        if (next && next.key !== mode) switchTool(next);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // Letters — direct access, only before the first point is placed.
      const behavior = DRAWING_TOOL_HOTKEYS[e.key.toLowerCase()];
      if (!behavior) return;

      // "A" doubles as the global smart-detect trigger (InteractionLayer). When
      // the smart-detect switch is active, let A run detection instead of
      // switching to the Arc tool.
      if (e.key.toLowerCase() === "a" && s.mapEditor.smartDetectEnabled) return;

      if (hasFirstPoint) return;

      const tool = tools.find((t) => t.behavior === behavior);
      if (!tool) return;
      if (tool.key !== mode) switchTool(tool);
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    // Capture phase so we run before InteractionLayer's keydown handlers and
    // can consume the event (stopImmediatePropagation) when we act on it.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabledDrawingMode, dispatch, store]);
}
