import { setWrapperMode } from "Features/mapEditor/mapEditorSlice";

import isOpeningAnnotation from "Features/annotations/utils/isOpeningAnnotation";
import IconResizeFrame from "Features/icons/IconResizeFrame";

import { EDITOR_2D } from "../../constants/commandEditors";
import { getSelectionGate } from "../../utils/selectionCommandState";

// « Déplacer / Redimensionner »: toggles the transform frame of the selection
// (body drag, resize + rotation handles — EditedObjectLayer, mapEditor
// wrapperMode). Point-based annotations only: openings have no wrapper.
export default {
  key: "WRAPPER_MODE",
  label: "Déplacer / Redimensionner",
  Icon: IconResizeFrame,
  editors: [EDITOR_2D],
  getState(ctx) {
    const gate = getSelectionGate(ctx);
    if (gate) return gate;
    if (ctx.selectedAnnotations.some((a) => isOpeningAnnotation(a))) {
      return { enabled: false, reason: "Indisponible sur une ouverture" };
    }
    return { enabled: true, active: ctx.wrapperMode };
  },
  run(ctx, { dispatch }) {
    dispatch(setWrapperMode(!ctx.wrapperMode));
  },
};
