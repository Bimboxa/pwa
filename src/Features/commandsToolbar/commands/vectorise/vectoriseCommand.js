import IconVectorisation from "Features/icons/IconVectorisation";

import ButtonVectorise from "./ButtonVectorise";
import { EDITOR_2D } from "../../constants/commandEditors";
import { getTargetsState } from "../../utils/selectionCommandState";

export const VECTORISE_TYPES = ["POLYGON"];

// « Vectoriser les murs »: image analysis of the base map inside the selected
// POLYGONs → wall annotations of a chosen template (useVectorisation,
// useVectoriseWallsAsPolylines, useTraceInteriorContours). Needs the scale.
export default {
  key: "VECTORISE",
  label: "Vectoriser les murs",
  Icon: IconVectorisation,
  Button: ButtonVectorise,
  editors: [EDITOR_2D],
  getState(ctx) {
    const state = getTargetsState(
      ctx,
      VECTORISE_TYPES,
      "Sélectionnez au moins une surface"
    );
    if (!state.enabled) return state;
    if (!ctx.hasScale) {
      return {
        enabled: false,
        reason: "Échelle requise pour la vectorisation",
      };
    }
    return { enabled: true };
  },
};
