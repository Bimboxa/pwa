import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";

import { TRANSFORM_TOOL_LABELS } from "../constants/transformToolStrings";
import { isTransformToolMode } from "./transformToolModes";

// Title of the drawing helper while an Extruder / Déplacer / Tourner tool is
// armed (threedEditor tool in 3D, drawing mode in 2D) — null otherwise: the
// helper keeps its "Mode dessin" title.
export default function selectTransformToolTitle(s) {
  const threedTool = selectActiveThreedTool(s);
  if (threedTool) return TRANSFORM_TOOL_LABELS[threedTool];
  const mode = s.mapEditor.enabledDrawingMode;
  return isTransformToolMode(mode) ? TRANSFORM_TOOL_LABELS[mode] : null;
}
