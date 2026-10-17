import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import {
  buildRevolutionAxisDraft,
  buildRevolutionAxisPlacementDraft,
} from "Features/revolutionAxes/utils/buildRevolutionAxisDrafts";

export const REVOLUTION_AXIS_TOOL_KEYS = [
  "REVOLUTION_AXIS_PLAN",
  "REVOLUTION_AXIS_PLACE",
];

function armTool(dispatch, toolKey, draft) {
  const tool = getDrawingToolByKey(toolKey);
  if (!tool) return;
  dispatch(setNewAnnotation(draft));
  dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
}

// Arms the drawing of a new axis on the current (horizontal) base map, or on a
// horizontal base map plane of the 3D editor.
export function startDrawRevolutionAxis(dispatch) {
  armTool(dispatch, "REVOLUTION_AXIS_PLAN", buildRevolutionAxisDraft());
}

// Arms the placement of an existing axis on the current (vertical) base map —
// the click creates its placement and poses the base map in 3D.
export function startPlaceRevolutionAxis(dispatch, axis) {
  if (!axis?.id) return;
  armTool(
    dispatch,
    "REVOLUTION_AXIS_PLACE",
    buildRevolutionAxisPlacementDraft(axis)
  );
}

// Whether the armed drawing mode is one of the axis tools.
export function isRevolutionAxisDrawingMode(drawingMode) {
  return REVOLUTION_AXIS_TOOL_KEYS.some(
    (key) => (getDrawingToolByKey(key)?.drawingMode ?? key) === drawingMode
  );
}
