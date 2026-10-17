import IconCurvature from "Features/icons/IconCurvature";

import ButtonCurvature from "./ButtonCurvature";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// « Courbure »: fits arcs through two or more selected POLYLINE annotations
// (useCurvature).
export default {
  key: "CURVATURE",
  label: "Courbure",
  Icon: IconCurvature,
  Button: ButtonCurvature,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    const targets = getTargets(ctx);
    const ok =
      targets.length >= 2 &&
      targets.every((a) => a.type === "POLYLINE" && a.points?.length >= 2);
    return ok
      ? { enabled: true }
      : { enabled: false, reason: "Sélectionnez au moins deux lignes" };
  },
};
