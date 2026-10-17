import TrendingUp from "@mui/icons-material/TrendingUp";

import ButtonAddSlope from "./ButtonAddSlope";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Ajouter une pente »: immediate action — appends a guide line along the
// main axis of the selected POLYGON with a default 10 % slope and selects it
// (useAddSlopeGuideLine).
export default {
  key: "ADD_SLOPE",
  label: "Ajouter une pente",
  Icon: TrendingUp,
  Button: ButtonAddSlope,
  getState: (ctx) =>
    getSingleAnnotationState(ctx, ["POLYGON"], "Réservé aux surfaces"),
};
