import { SelectAll } from "@mui/icons-material";

import ButtonAssignBusinessObject from "./ButtonAssignBusinessObject";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Affecter les annotations à l'intérieur »: links every annotation inside
// the selected main polygon of a business object (locations) to that object
// (useAssignBusinessObjectToAnnotations).
export default {
  key: "ASSIGN_BUSINESS_OBJECT",
  label: "Affecter les annotations à l'intérieur",
  Icon: SelectAll,
  Button: ButtonAssignBusinessObject,
  getState(ctx) {
    const state = getSingleAnnotationState(
      ctx,
      ["POLYGON"],
      "Réservé aux surfaces"
    );
    if (!state.enabled) return state;
    if (!ctx.selectedAnnotation.canAssignMainBusinessObject) {
      return {
        enabled: false,
        reason: "Réservé au polygone principal d'un ouvrage",
      };
    }
    return { enabled: true };
  },
};
