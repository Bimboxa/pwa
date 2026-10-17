import { setAnchorSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import IconAnchorSnap from "Features/annotations/components/IconAnchorSnap";

import { EDITOR_2D } from "../../constants/commandEditors";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Ancrer sur un voisin »: arms the anchor pick mode of the selected
// POLYLINE / STRIP (the next clicked annotation becomes its anchor). Active
// while armed on this annotation — clicking again cancels.
export default {
  key: "ANCHOR",
  label: "Ancrer sur un voisin",
  Icon: IconAnchorSnap,
  editors: [EDITOR_2D],
  getState(ctx) {
    const active =
      Boolean(ctx.anchorSourceAnnotationId) &&
      ctx.anchorSourceAnnotationId === ctx.selectedAnnotation?.id;
    if (ctx.anchorSourceAnnotationId && !ctx.selectedAnnotation) {
      // Pick mode armed (selection cleared): the button cancels it.
      return { enabled: true, active: true };
    }
    const state = getSingleAnnotationState(
      ctx,
      ["POLYLINE", "STRIP"],
      "Réservé aux lignes et aux bandes"
    );
    return state.enabled ? { enabled: true, active } : state;
  },
  run(ctx, { dispatch }) {
    if (ctx.anchorSourceAnnotationId) {
      dispatch(setAnchorSourceAnnotationId(null));
      return;
    }
    dispatch(setAnchorSourceAnnotationId(ctx.selectedAnnotation.id));
    dispatch(clearSelection());
  },
};
