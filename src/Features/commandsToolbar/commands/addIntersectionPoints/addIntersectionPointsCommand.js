import IconIntersectionPoint from "Features/icons/IconIntersectionPoint";

import addIntersectionPointsService from "./addIntersectionPointsService";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

const TYPES = ["POLYLINE", "POLYGON"];
const TYPES_REASON = "Sélectionnez exactement deux lignes ou surfaces";

// « Ajouter les points d'intersection »: with exactly two lines / surfaces
// selected, inserts a shared vertex in both at every crossing of their
// contours (addIntersectionPointsService).
export default {
  key: "ADD_INTERSECTION_POINTS",
  usesSelection: true,
  label: "Ajouter les points d'intersection",
  Icon: IconIntersectionPoint,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    const targets = getTargets(ctx, TYPES);
    if (ctx.selectedAnnotations.length !== 2 || targets.length !== 2) {
      return { enabled: false, reason: TYPES_REASON };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch, store }) {
    const targets = getTargets(ctx, TYPES);
    return addIntersectionPointsService({
      annotationIds: targets.map((a) => a.id),
      baseMap: ctx.baseMap,
      meterByPx: ctx.meterByPx,
      projectId: store.getState().projects.selectedProjectId,
      dispatch,
    });
  },
};
