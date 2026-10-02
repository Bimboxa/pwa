import { getDrawingToolTypeByKey } from "Features/mapEditor/constants/drawingTools.jsx";

// "Coupe face" tool group (3D editor): its tools (segment, polyline) are
// DRAWING_TOOLS_BY_TYPE.FACE_CUT.
export const FACE_CUT_TOOL_TYPE = "FACE_CUT";

export function isFaceCutDrawingMode(enabledDrawingMode) {
  return getDrawingToolTypeByKey(enabledDrawingMode) === FACE_CUT_TOOL_TYPE;
}
