import { setSubtractSourceAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import IconSubtract from "Features/annotations/components/IconSubtract";

import { getSingleAnnotationState } from "../../utils/selectionCommandState";

export const SUBTRACT_TYPES = ["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"];
export const SUBTRACT_TYPES_REASON =
  "Réservé aux surfaces, rectangles, lignes et bandes";

// « Soustraire une annotation »: arms the subtraction pick mode with the
// selected annotation as the CARVED pivot — each clicked annotation is
// subtracted from it (db.relAnnotationSubtractions). Active while armed;
// clicking again cancels. A 3D mesh (isMesh3d: a vertical face pulled into a
// box, a sheet drawn in 3D) is a valid pivot: only a relation is written, the
// 3D carve reads its faces as they are.
export default {
  key: "SUBTRACT",
  label: "Soustraire une annotation",
  Icon: IconSubtract,
  getState(ctx) {
    if (ctx.subtractSourceAnnotationId && !ctx.selectedAnnotation) {
      return { enabled: true, active: true };
    }
    const state = getSingleAnnotationState(
      ctx,
      SUBTRACT_TYPES,
      SUBTRACT_TYPES_REASON,
      { allowMesh3d: true }
    );
    if (!state.enabled) return state;
    return {
      enabled: true,
      active: ctx.subtractSourceAnnotationId === ctx.selectedAnnotation?.id,
    };
  },
  run(ctx, { dispatch }) {
    if (ctx.subtractSourceAnnotationId) {
      dispatch(setSubtractSourceAnnotationId(null));
      return;
    }
    dispatch(setSubtractSourceAnnotationId(ctx.selectedAnnotation.id));
    dispatch(clearSelection());
  },
};
