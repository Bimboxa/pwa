import { OpenWith } from "@mui/icons-material";

import { activateMoveTool } from "Features/threedVertexOffset/utils/resolveVertexOffsetTarget";

import startToolGroupDraw from "../../utils/startToolGroupDraw";
import {
  getThreedToolState,
  getToolGroupState,
} from "../../utils/drawToolCommandState";

// « Déplacer » (M): 2D — the MOVE_ANNOTATION tool group (move an annotation
// from one of its points, Features/annotationTransform); 3D — activateMoveTool
// (a selected face arms the vertex offset mode instead of the whole-annotation
// move, Features/threedAnnotationMove / threedVertexOffset). Shift+M stays the
// quick point editing toggle (plainOnly).
export default {
  key: "MOVE_ANNOTATION",
  label: "Déplacer",
  Icon: OpenWith,
  hotkey: { key: "m", plainOnly: true },
  getState: (ctx) =>
    ctx.isThreedEditor
      ? getThreedToolState(ctx, ["MOVE_ANNOTATION", "VERTEX_OFFSET"])
      : getToolGroupState(ctx, "MOVE_ANNOTATION"),
  run(ctx, { dispatch, store, getThreedEditor }) {
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
