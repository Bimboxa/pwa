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

import { getDrawingToolsByShape } from "../constants/drawingTools.jsx";
import { DRAWING_TOOL_HOTKEYS } from "../constants/drawingToolHotkeys";
import buildToolDraft from "../utils/buildToolDraft";

// Keyboard shortcuts to switch the active drawing tool without leaving the
// drawing flow:
//   - Tab / Shift+Tab : cycle next / previous tool within the current shape
//     group (allowed any time a tool is active).
//   - R / L / C / G    : direct-access to a tool by behavior, but ONLY while no
//     first point has been placed yet (so the in-drawing letter shortcuts keep
//     priority once the object has started).
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

    const switchTool = (tool) => {
      const s = store.getState();
      const newAnnotation = s.annotations.newAnnotation ?? {};
      const openingDefaults = {
        strokeWidth: s.mapEditor.openingStrokeWidth,
        strokeWidthUnit: s.mapEditor.openingStrokeWidthUnit,
      };
      const templateId = newAnnotation.annotationTemplateId;
      if (templateId) {
        dispatch(
          setSelectedToolKeyForTemplate({ templateId, toolKey: tool.key })
        );
      }
      dispatch(setNewAnnotation(buildToolDraft(newAnnotation, tool, openingDefaults)));
      dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
      // Start the new tool from a clean geometry (no-op before the first point,
      // needed when cycling mid-shape via Tab).
      dispatch(clearDrawingPolylinePoints());
      dispatch(clearDrawingRectanglePoints());
      dispatch(clearDrawingSegmentPoints());
      dispatch(clearRectDims());
      dispatch(clearConstraintBuffer());
      dispatch(setRectHasFirstPoint(false));
    };

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const s = store.getState();
      const mode = s.mapEditor.enabledDrawingMode;
      if (!mode) return;

      const drawingShape = s.annotations.newAnnotation?.drawingShape;
      if (!drawingShape) return;
      const tools = getDrawingToolsByShape(drawingShape);
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

      const hasFirstPoint =
        s.mapEditor.drawingPolylinePoints.length > 0 ||
        s.mapEditor.drawingRectanglePoints.length > 0 ||
        s.mapEditor.drawingSegmentPoints.length > 0 ||
        s.mapEditor.rectHasFirstPoint;
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
