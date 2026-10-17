import IconConvertAnnotation from "Features/icons/IconConvertAnnotation";

import ButtonConvert from "./ButtonConvert";
import { getTargetsState } from "../../utils/selectionCommandState";

export const CONVERT_TYPES = ["POLYGON"];

// « Transformer » (Surface → Ligne): converts the selected POLYGONs to
// polylines of a chosen template (useConvertAnnotationsToPolyline), with the
// keep-openings / explode-segments options and the target layer.
export default {
  key: "CONVERT",
  label: "Transformer (surface → ligne)",
  Icon: IconConvertAnnotation,
  Button: ButtonConvert,
  getState: (ctx) =>
    getTargetsState(ctx, CONVERT_TYPES, "Sélectionnez au moins une surface"),
};
