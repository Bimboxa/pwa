import {
  getDrawingToolByKey,
  getDrawingToolTypeByKey,
} from "Features/mapEditor/constants/drawingTools.jsx";

// "Coupe face" tool group (3D editor): its tools (segment, polyline,
// rectangle, horizontal / vertical axis cut) are DRAWING_TOOLS_BY_TYPE.FACE_CUT.
export const FACE_CUT_TOOL_TYPE = "FACE_CUT";

// Behavior of the axis cut tools (« Découpe horizontale / verticale »).
export const FACE_AXIS_CUT_BEHAVIOR = "FACE_AXIS_CUT";

export function isFaceCutDrawingMode(enabledDrawingMode) {
  return getDrawingToolTypeByKey(enabledDrawingMode) === FACE_CUT_TOOL_TYPE;
}

// "H" | "V" for an axis cut tool, null for any other mode.
export function getFaceCutAxis(enabledDrawingMode) {
  const tool = getDrawingToolByKey(enabledDrawingMode);
  if (!tool || tool.behavior !== FACE_AXIS_CUT_BEHAVIOR) return null;
  return tool.axis ?? null;
}

export function isFaceCutAxisMode(enabledDrawingMode) {
  return getFaceCutAxis(enabledDrawingMode) !== null;
}

export function isFaceCutRectangleMode(enabledDrawingMode) {
  const tool = getDrawingToolByKey(enabledDrawingMode);
  return Boolean(
    tool &&
    tool.annotationType === FACE_CUT_TOOL_TYPE &&
    tool.behavior === "RECTANGLE"
  );
}
