import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";

import IconHollowOut from "Features/annotations/components/IconHollowOut";

import { EDITOR_2D, EDITOR_3D } from "../../constants/commandEditors";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";
import {
  SUBTRACT_TYPES,
  SUBTRACT_TYPES_REASON,
} from "../subtract/subtractCommand";

// « Évider » — opens the carve dialog (mounted by both editors through
// DialogHollowOutAnnotationOutlet):
//  - 2D (E): the selected POLYGON is carved by the footprints of the visible
//    annotations of its base map, its geometry is rewritten
//    (DialogHollowOutAnnotation);
//  - 3D: the annotations whose solid intersects the selected one are offered
//    as subtractions (DialogHollowOutAnnotation3d) — relations only, so the
//    hosts are those of « Soustraire », 3D meshes included.
// The letter is « Extruder » in the 3D editor, so the hotkey is 2D only.
export default {
  key: "HOLLOW_OUT",
  usesSelection: true,
  label: "Évider (découper par les annotations qui recoupent)",
  Icon: IconHollowOut,
  hotkey: { key: "e", editors: [EDITOR_2D] },
  getState: (ctx) =>
    ctx.editor === EDITOR_3D
      ? getSingleAnnotationState(ctx, SUBTRACT_TYPES, SUBTRACT_TYPES_REASON, {
          allowMesh3d: true,
        })
      : getSingleAnnotationState(ctx, ["POLYGON"], "Réservé aux surfaces"),
  run(ctx, { dispatch }) {
    dispatch(setHollowOutDialogAnnotationId(ctx.selectedAnnotation.id));
  },
};
