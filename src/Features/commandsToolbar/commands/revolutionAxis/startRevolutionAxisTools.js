import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import {
  buildRevolutionAxisDraft,
  buildRevolutionAxisPlacementDraft,
} from "Features/revolutionAxes/utils/buildRevolutionAxisDrafts";

// Drawing tools of the two axis commands: « Axe de révolution » draws a new
// axis (REVOLUTION_AXIS_PLAN), « Axe sur plan de coupe » poses an existing
// one on a vertical base map (REVOLUTION_AXIS_PLACE).
export const REVOLUTION_AXIS_DRAW_TOOL_KEY = "REVOLUTION_AXIS_PLAN";
export const REVOLUTION_AXIS_PLACE_TOOL_KEY = "REVOLUTION_AXIS_PLACE";

function armTool(dispatch, toolKey, draft) {
  const tool = getDrawingToolByKey(toolKey);
  if (!tool) return;
  dispatch(setNewAnnotation(draft));
  dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
}

function isDrawingModeOfTool(drawingMode, toolKey) {
  return (getDrawingToolByKey(toolKey)?.drawingMode ?? toolKey) === drawingMode;
}

// Arms the drawing of a new axis on the current (horizontal) base map, or on a
// horizontal base map plane of the 3D editor.
export function startDrawRevolutionAxis(dispatch) {
  armTool(dispatch, REVOLUTION_AXIS_DRAW_TOOL_KEY, buildRevolutionAxisDraft());
}

// Arms the placement of an existing axis on the current (vertical) base map —
// the click creates its placement and poses the base map in 3D.
export function startPlaceRevolutionAxis(dispatch, axis) {
  if (!axis?.id) return;
  armTool(
    dispatch,
    REVOLUTION_AXIS_PLACE_TOOL_KEY,
    buildRevolutionAxisPlacementDraft(axis)
  );
}

// Whether the armed drawing mode is the axis drawing tool.
export function isRevolutionAxisDrawDrawingMode(drawingMode) {
  return isDrawingModeOfTool(drawingMode, REVOLUTION_AXIS_DRAW_TOOL_KEY);
}

// Whether the armed drawing mode is the axis placement tool.
export function isRevolutionAxisPlaceDrawingMode(drawingMode) {
  return isDrawingModeOfTool(drawingMode, REVOLUTION_AXIS_PLACE_TOOL_KEY);
}
