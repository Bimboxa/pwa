import { Cached } from "@mui/icons-material";

import ButtonToggleStripType from "./ButtonToggleStripType";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Basculer ligne ↔ bande (mur) »: cycles the selected POLYLINE / STRIP (open
// or closed) through POLYLINE → STRIP (side A) → STRIP (side B) → POLYLINE
// while keeping the thick band visually fixed (useToggleAnnotationStripType).
export default {
  key: "TOGGLE_STRIP_TYPE",
  usesSelection: true,
  label: "Basculer ligne ↔ bande (mur)",
  Icon: Cached,
  Button: ButtonToggleStripType,
  getState: (ctx) =>
    getSingleAnnotationState(
      ctx,
      ["POLYLINE", "STRIP"],
      "Réservé aux lignes et aux bandes"
    ),
};
