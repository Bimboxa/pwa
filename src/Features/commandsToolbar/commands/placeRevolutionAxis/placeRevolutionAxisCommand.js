import IconPlaceRevolutionAxis from "Features/icons/IconPlaceRevolutionAxis";

import ButtonPlaceRevolutionAxis from "./ButtonPlaceRevolutionAxis";
import { EDITOR_2D } from "../../constants/commandEditors";
import { isRevolutionAxisPlaceDrawingMode } from "../revolutionAxis/startRevolutionAxisTools";
import {
  DRAW_IN_PROGRESS_REASON,
  getDrawToolsGate,
} from "../../utils/drawToolCommandState";

export const VERTICAL_BASE_MAP_ONLY_REASON =
  "Réservé aux fonds de plan de coupe (verticaux)";

// « Axe sur plan de coupe » (Features/revolutionAxes): poses an EXISTING
// revolution axis of the scope on the current VERTICAL base map (coupe /
// élévation). The Button lists the axes of the scope in a menu — disabled
// while the scope has none — and picking one arms the one-click placement
// tool (startPlaceRevolutionAxis): the click creates the
// REVOLUTION_AXIS_PLACEMENT and poses the base map in 3D. Drawing a new axis
// is the « Axe de révolution » command, on a horizontal plan.
export default {
  key: "PLACE_REVOLUTION_AXIS",
  label: "Axe sur plan de coupe",
  Icon: IconPlaceRevolutionAxis,
  editors: [EDITOR_2D],
  Button: ButtonPlaceRevolutionAxis,
  getState(ctx) {
    if (ctx.viewerKey !== "MAP") {
      return { enabled: false, reason: "Réservé au module Dessin" };
    }
    const gate = getDrawToolsGate(ctx);
    if (gate) return gate;
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.isVerticalBaseMap) {
      return { enabled: false, reason: VERTICAL_BASE_MAP_ONLY_REASON };
    }
    if (ctx.enabledDrawingMode) {
      const active = isRevolutionAxisPlaceDrawingMode(ctx.enabledDrawingMode);
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
};
