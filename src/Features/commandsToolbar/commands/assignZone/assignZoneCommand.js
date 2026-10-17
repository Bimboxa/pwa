import { SelectAll } from "@mui/icons-material";

import ButtonAssignZone from "./ButtonAssignZone";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Affecter la zone »: links every annotation inside the selected zone
// delimitation polygon to the zone (useAssignZoneToAnnotations — zonings).
export default {
  key: "ASSIGN_ZONE",
  label: "Affecter la zone (relier les annotations à l'intérieur)",
  Icon: SelectAll,
  Button: ButtonAssignZone,
  getState(ctx) {
    const state = getSingleAnnotationState(
      ctx,
      ["POLYGON"],
      "Réservé aux surfaces"
    );
    if (!state.enabled) return state;
    if (!ctx.selectedAnnotation.isZoneAnnotation) {
      return { enabled: false, reason: "Réservé aux délimitations de zone" };
    }
    return { enabled: true };
  },
};
