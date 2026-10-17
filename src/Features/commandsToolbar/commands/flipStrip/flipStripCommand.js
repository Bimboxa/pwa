import { Flip } from "@mui/icons-material";

import ButtonFlipStrip from "./ButtonFlipStrip";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Inverser le sens » of the selected STRIP / LINEAR_LAYOUT
// (stripOrientation ±1). Goes through useUpdateAnnotation so the openings
// glued on the band's median line follow the side flip.
export default {
  key: "FLIP_STRIP",
  label: "Inverser le sens",
  Icon: Flip,
  Button: ButtonFlipStrip,
  getState: (ctx) =>
    getSingleAnnotationState(
      ctx,
      ["STRIP", "LINEAR_LAYOUT"],
      "Réservé aux bandes et aux calepinages"
    ),
};
