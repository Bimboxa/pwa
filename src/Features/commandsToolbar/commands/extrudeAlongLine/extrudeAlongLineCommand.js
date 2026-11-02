import { setSweepProfileAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import IconExtrudeAlongLine from "Features/icons/IconExtrudeAlongLine";

import { DRAW_IN_PROGRESS_REASON } from "../../utils/drawToolCommandState";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

const TYPES_REASON = "Réservé aux lignes";
const PICK_IN_PROGRESS_REASON = "Un mode de sélection est déjà actif";

// « Extruder le long d'une ligne »: the selected POLYLINE is the PROFILE;
// arms the sweep pick mode (mapEditor.sweepProfileAnnotationId) — the next
// clicked annotation, in 2D or 3D, is the guide and a third annotation is
// created (createSweepAlongLineService). Active while armed; clicking again
// cancels. The result keeps `sweepSources` and can be rebuilt from the
// annotation toolbar (« Actualiser la 3D »).
export default {
  key: "EXTRUDE_ALONG_LINE",
  label: "Extruder le long d'une ligne",
  Icon: IconExtrudeAlongLine,
  getState(ctx) {
    if (ctx.sweepProfileAnnotationId && !ctx.selectedAnnotation) {
      return { enabled: true, active: true };
    }
    const state = getSingleAnnotationState(ctx, ["POLYLINE"], TYPES_REASON);
    if (!state.enabled) return state;
    if (ctx.enabledDrawingMode) {
      return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.subtractPickAnnotationId) {
      return { enabled: false, reason: PICK_IN_PROGRESS_REASON };
    }
    return {
      enabled: true,
      active: ctx.sweepProfileAnnotationId === ctx.selectedAnnotation?.id,
    };
  },
  run(ctx, { dispatch }) {
    if (ctx.sweepProfileAnnotationId) {
      dispatch(setSweepProfileAnnotationId(null));
      return;
    }
    dispatch(setSweepProfileAnnotationId(ctx.selectedAnnotation.id));
    dispatch(clearSelection());
  },
};
