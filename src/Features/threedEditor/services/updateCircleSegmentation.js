import { setCircleSegmentation } from "Features/threedEditor/threedEditorSlice";
import { applyCircleSegmentation } from "Features/geometry/utils/circleSegmentation";

import { storeCircleSegmentation } from "./circleSegmentationLocalStorage";

// Thunk: change the circle segmentation of the 3D meshes ({ arc } and / or
// { revolution }, chords per full circle). The module-level settings are
// applied FIRST — the redux change then re-runs the 3D build
// (useAutoLoadAnnotationsInThreedEditor) and the quantities
// (useAnnotationsV2), which read them at use.
export default function updateCircleSegmentation(patch) {
  return (dispatch, getState) => {
    const next = applyCircleSegmentation({
      ...getState().threedEditor.circleSegmentation,
      ...patch,
    });
    storeCircleSegmentation(next);
    dispatch(setCircleSegmentation(next));
  };
}
