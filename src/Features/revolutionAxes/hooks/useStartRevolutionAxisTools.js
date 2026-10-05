import { useDispatch } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import {
  buildRevolutionAxisDraft,
  buildRevolutionAxisPlacementDraft,
} from "../utils/buildRevolutionAxisDrafts";

// Arms the two revolution axis tools:
// - startDrawAxis: draw a new axis on the current (HORIZONTAL) base map;
// - startPlaceAxis(axis): drop an existing axis on the current (VERTICAL)
//   base map — the click creates its placement and poses the base map in 3D.
export default function useStartRevolutionAxisTools() {
  const dispatch = useDispatch();

  const arm = (toolKey, draft) => {
    const tool = getDrawingToolByKey(toolKey);
    if (!tool) return;
    dispatch(setNewAnnotation(draft));
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
  };

  const startDrawAxis = () =>
    arm("REVOLUTION_AXIS_PLAN", buildRevolutionAxisDraft());

  const startPlaceAxis = (axis) => {
    if (!axis?.id) return;
    arm("REVOLUTION_AXIS_PLACE", buildRevolutionAxisPlacementDraft(axis));
  };

  return { startDrawAxis, startPlaceAxis };
}
