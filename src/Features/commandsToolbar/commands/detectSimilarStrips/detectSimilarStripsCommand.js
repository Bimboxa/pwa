import { AutoFixHigh } from "@mui/icons-material";

import ButtonDetectSimilarStrips from "./ButtonDetectSimilarStrips";
import { EDITOR_2D } from "../../constants/commandEditors";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Détection similaire »: finds the strips of the base map image similar to
// the selected STRIP within the 2D viewport (detectSimilarStrips) and
// proposes them (Space validates).
export default {
  key: "DETECT_SIMILAR_STRIPS",
  label: "Détection similaire",
  Icon: AutoFixHigh,
  Button: ButtonDetectSimilarStrips,
  editors: [EDITOR_2D],
  getState: (ctx) =>
    getSingleAnnotationState(ctx, ["STRIP"], "Réservé aux bandes"),
};
