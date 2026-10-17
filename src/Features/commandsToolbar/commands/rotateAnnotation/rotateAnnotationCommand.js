import { RotateRight } from "@mui/icons-material";

import { setRotateAnnotationModeActive } from "Features/threedEditor/threedEditorSlice";

import startToolGroupDraw from "../../utils/startToolGroupDraw";
import {
  getThreedToolState,
  getToolGroupState,
} from "../../utils/drawToolCommandState";

// « Tourner » (R): 2D — the ROTATE_ANNOTATION tool group; 3D — threedEditor
// mode toggle. « R » is « Recommencer à chaque clic » of the 3D « Déplacer »
// while that mode is active: the hotkey yields.
export default {
  key: "ROTATE_ANNOTATION",
  label: "Tourner",
  Icon: RotateRight,
  hotkey: {
    key: "r",
    plainOnly: true,
    yieldWhen: (state, ctx) =>
      ctx.isThreedEditor &&
      Boolean(state.threedEditor?.moveAnnotationMode?.active),
  },
  getState: (ctx) =>
    ctx.isThreedEditor
      ? getThreedToolState(ctx, ["ROTATE_ANNOTATION"])
      : getToolGroupState(ctx, "ROTATE_ANNOTATION"),
  run(ctx, { dispatch, store }) {
    if (ctx.isThreedEditor) {
      dispatch(
        setRotateAnnotationModeActive(
          !store.getState().threedEditor.rotateAnnotationMode.active
        )
      );
      return;
    }
    startToolGroupDraw(dispatch, store.getState(), "ROTATE_ANNOTATION");
  },
};
