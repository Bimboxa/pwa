import { Healing } from "@mui/icons-material";

import repairAnnotationService from "./repairAnnotationService";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Réparer la géométrie » of the selected POLYLINE / POLYGON / STRIP
// (self-intersections, duplicated points…).
export default {
  key: "REPAIR",
  label: "Réparer la géométrie",
  Icon: Healing,
  getState: (ctx) =>
    getSingleAnnotationState(
      ctx,
      ["POLYLINE", "POLYGON", "STRIP"],
      "Réservé aux lignes, surfaces et bandes"
    ),
  run(ctx, { store }) {
    return repairAnnotationService({
      annotation: ctx.selectedAnnotation,
      baseMap: ctx.baseMap,
      projectId: store.getState().projects.selectedProjectId,
    });
  },
};
