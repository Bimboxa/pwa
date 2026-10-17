import IconDilate from "Features/annotations/components/IconDilate";

import ButtonDilate from "./ButtonDilate";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// Closed shapes of the selection: surfaces and closed lines.
export function getDilateTargets(ctx) {
  return getTargets(ctx).filter(
    (a) => a.type === "POLYGON" || (a.type === "POLYLINE" && a.closeLine)
  );
}

// « Dilater / Contracter »: offsets the selected closed shapes by ±1 px
// (offsetPolygon), popover with the two buttons.
export default {
  key: "DILATE",
  label: "Dilater / Contracter",
  Icon: IconDilate,
  Button: ButtonDilate,
  getState(ctx) {
    const gate = getSelectionGate(ctx);
    if (gate) return gate;
    return getDilateTargets(ctx).length
      ? { enabled: true }
      : {
          enabled: false,
          reason: "Sélectionnez une surface ou une ligne fermée",
        };
  },
};
