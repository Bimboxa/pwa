import { setSubtractTargetAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import IconSubtractFrom from "Features/annotations/components/IconSubtractFrom";

import { getSingleAnnotationState } from "../../utils/selectionCommandState";
import {
  SUBTRACT_TYPES,
  SUBTRACT_TYPES_REASON,
} from "../subtract/subtractCommand";

// « À soustraire de… »: reverse of SUBTRACT — the selected annotation is the
// SUBTRACTED pivot, each clicked annotation gets carved by it. Same
// relAnnotationSubtractions row, only the pick direction differs — and the
// same opening to 3D meshes (a closed mesh cuts like any solid).
export default {
  key: "SUBTRACT_FROM",
  label: "À soustraire de…",
  Icon: IconSubtractFrom,
  getState(ctx) {
    if (ctx.subtractTargetAnnotationId && !ctx.selectedAnnotation) {
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
      active: ctx.subtractTargetAnnotationId === ctx.selectedAnnotation?.id,
    };
  },
  run(ctx, { dispatch }) {
    if (ctx.subtractTargetAnnotationId) {
      dispatch(setSubtractTargetAnnotationId(null));
      return;
    }
    dispatch(setSubtractTargetAnnotationId(ctx.selectedAnnotation.id));
    dispatch(clearSelection());
  },
};
