import ButtonAutoSlope from "./ButtonAutoSlope";
import IconAutoSlope from "./IconAutoSlope";
import { getSingleAnnotationState } from "../../utils/selectionCommandState";

// « Pente auto »: immediate action — slopes the selected POLYGON so its
// surface connects the top edges of its two adjacent polygons
// (useApplyAutoSlope).
export default {
  key: "AUTO_SLOPE",
  label: "Pente auto (raccorder les deux surfaces voisines)",
  Icon: IconAutoSlope,
  Button: ButtonAutoSlope,
  getState: (ctx) =>
    getSingleAnnotationState(ctx, ["POLYGON"], "Réservé aux surfaces"),
};
