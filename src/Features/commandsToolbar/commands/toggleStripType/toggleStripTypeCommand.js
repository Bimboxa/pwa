import { Cached } from "@mui/icons-material";

import ButtonToggleStripType from "./ButtonToggleStripType";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Basculer ligne ↔ bande (mur) »: cycles the selected open POLYLINE / STRIP
// through POLYLINE → STRIP (side A) → STRIP (side B) → POLYLINE while keeping
// the thick band visually fixed (useToggleAnnotationStripType).
export default {
  key: "TOGGLE_STRIP_TYPE",
  label: "Basculer ligne ↔ bande (mur)",
  Icon: Cached,
  Button: ButtonToggleStripType,
  getState(ctx) {
    const state = getSingleAnnotationState(
      ctx,
      ["POLYLINE", "STRIP"],
      "Réservé aux lignes et aux bandes"
    );
    if (!state.enabled) return state;
    if (ctx.selectedAnnotation.closeLine) {
      return { enabled: false, reason: "Indisponible sur une ligne fermée" };
    }
    return { enabled: true };
  },
};
