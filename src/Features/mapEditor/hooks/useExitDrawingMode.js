import { useDispatch, useStore } from "react-redux";

import {
  clearConstraintBuffer,
  setEnabledDrawingMode,
} from "../mapEditorSlice";
import {
  setNewAnnotation,
  setTempAnnotations,
} from "Features/annotations/annotationsSlice";
import {
  cancelInProgressPolyline,
  setExtrudeModeActive,
  setIsolateFaceModeActive,
  setMergeFacesModeActive,
  setMoveAnnotationModeActive,
  setRotateAnnotationModeActive,
  setVertexOffsetModeActive,
} from "Features/threedEditor/threedEditorSlice";
import selectActiveThreedTool from "Features/threedDrawing/utils/selectActiveThreedTool";

// "Quitter le dessin" (X of the drawing helper): leaves the armed draw / tool
// and DROPS the annotation in progress — unlike Escape, whose first press
// commits it. Same redux exit as the MODULE switch: InteractionLayer's
// mode → null effect clears its local points / brush / preview, the 3D bridge
// (useTemplateFaceDrawBridge) deactivates the 3D drawing mode, and
// useAnnotationTransformTool drops a 2D Déplacer / Tourner session. The
// selection is deliberately kept.
const THREED_TOOL_DEACTIVATORS = {
  EXTRUDE: setExtrudeModeActive,
  MOVE_ANNOTATION: setMoveAnnotationModeActive,
  VERTEX_OFFSET: setVertexOffsetModeActive,
  ROTATE_ANNOTATION: setRotateAnnotationModeActive,
  ISOLATE_FACE: setIsolateFaceModeActive,
  MERGE_FACES: setMergeFacesModeActive,
};

export default function useExitDrawingMode() {
  const dispatch = useDispatch();
  const store = useStore();

  return function exitDrawingMode() {
    const state = store.getState();
    const threedTool = selectActiveThreedTool(state);
    const deactivate = THREED_TOOL_DEACTIVATORS[threedTool];
    if (deactivate) dispatch(deactivate(false));
    // 3D template-less polyline: not covered by the bridge's deactivation.
    dispatch(cancelInProgressPolyline());
    dispatch(clearConstraintBuffer());
    dispatch(setEnabledDrawingMode(null));
    dispatch(setNewAnnotation({}));
    dispatch(setTempAnnotations([]));
  };
}
