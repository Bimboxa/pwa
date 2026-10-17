import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";

import IconHollowOut from "Features/annotations/components/IconHollowOut";

import { EDITOR_2D } from "../../constants/commandEditors";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Évider » (E in 2D): carve the selected POLYGON by the footprints of the
// visible annotations — opens the carve dialog (DialogHollowOutAnnotation,
// mounted by both editors through DialogHollowOutAnnotationOutlet). The letter
// is « Extruder » in the 3D editor, so the hotkey is 2D only.
export default {
  key: "HOLLOW_OUT",
  label: "Évider (découper par les annotations visibles)",
  Icon: IconHollowOut,
  hotkey: { key: "e", editors: [EDITOR_2D] },
  getState: (ctx) =>
    getSingleAnnotationState(ctx, ["POLYGON"], "Réservé aux surfaces"),
  run(ctx, { dispatch }) {
    dispatch(setHollowOutDialogAnnotationId(ctx.selectedAnnotation.id));
  },
};
