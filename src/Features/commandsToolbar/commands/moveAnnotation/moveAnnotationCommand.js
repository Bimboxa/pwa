import { OpenWith } from "@mui/icons-material";

import { setMoveAnnotationModeActive } from "Features/threedEditor/threedEditorSlice";
import { activateMoveTool } from "Features/threedVertexOffset/utils/resolveVertexOffsetTarget";

import startToolGroupDraw from "../../utils/startToolGroupDraw";
import {
  DRAW_IN_PROGRESS_REASON,
  getThreedToolState,
  getToolGroupState,
} from "../../utils/drawToolCommandState";

// « Déplacer » (M): 2D — the MOVE_ANNOTATION tool group (move an annotation
// from one of its points, Features/annotationTransform); 3D — activateMoveTool
// (a selected face arms the vertex offset mode instead of the whole-annotation
// move, Features/threedAnnotationMove / threedVertexOffset); in the Maillage
// module it carries a cut line (Features/threedCutLines); in the 2D editor of
// the Fonds de plan module it moves the selected section mark
// (Features/baseMapLinks). Shift+M stays the
// quick point editing toggle (plainOnly).
export default {
  key: "MOVE_ANNOTATION",
  usesSelection: true,
  label: "Déplacer",
  Icon: OpenWith,
  hotkey: { key: "m", plainOnly: true },
  getState(ctx) {
    if (ctx.isThreedEditor) {
      return getThreedToolState(ctx, ["MOVE_ANNOTATION", "VERTEX_OFFSET"]);
    }
    // Fonds de plan module (2D): the module has no drawing tools (its
    // listings popper is a legend), but a selected section mark — on its
    // plan, or located on a vertical base map — is moved with this tool.
    if (ctx.viewerKey === "BASE_MAPS") {
      if (ctx.readOnly) return { enabled: false, reason: ctx.readOnlyReason };
      if (ctx.enabledDrawingMode) {
        return ctx.activeToolType === "MOVE_ANNOTATION"
          ? { enabled: true, active: true }
          : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
      }
      if (ctx.selectedAnnotation?.type !== "BASE_MAP_LINK") {
        return { enabled: false, reason: "Sélectionnez un trait de coupe" };
      }
      return { enabled: true };
    }
    return getToolGroupState(ctx, "MOVE_ANNOTATION");
  },
  run(ctx, { dispatch, store, getThreedEditor }) {
    if (ctx.isThreedEditor && ctx.viewerKey === "MESHES") {
      // Maillage module: the tool carries a cut line — never the vertex
      // offset mode a selected maille face would arm (activateMoveTool).
      dispatch(
        setMoveAnnotationModeActive(
          !store.getState().threedEditor.moveAnnotationMode.active
        )
      );
      return;
    }
    if (ctx.isThreedEditor) {
      activateMoveTool({
        dispatch,
        state: store.getState(),
        editor: getThreedEditor(),
      });
      return;
    }
    startToolGroupDraw(dispatch, store.getState(), "MOVE_ANNOTATION");
  },
};
