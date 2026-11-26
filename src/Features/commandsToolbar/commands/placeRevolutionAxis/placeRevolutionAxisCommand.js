import IconPlaceRevolutionAxis from "Features/icons/IconPlaceRevolutionAxis";

import ButtonPlaceRevolutionAxis from "./ButtonPlaceRevolutionAxis";
import { EDITOR_2D } from "../../constants/commandEditors";
import {
  isRevolutionAxisPlaceDrawingMode,
  isRevolutionAxisSectionDrawingMode,
} from "../revolutionAxis/startRevolutionAxisTools";
import {
  DRAW_IN_PROGRESS_REASON,
  getDrawToolsGate,
} from "../../utils/drawToolCommandState";

export const VERTICAL_BASE_MAP_ONLY_REASON =
  "Réservé aux fonds de plan de coupe (verticaux)";

// « Axe sur plan de coupe » (Features/revolutionAxes), on the current
// VERTICAL base map (coupe / élévation). The Button opens a menu: draw a NEW
// standalone axis there (startDrawRevolutionAxisOnSection: foot, then half
// base + height — no plan axis, the base map keeps its pose), or pose an
// EXISTING axis of the scope (startPlaceRevolutionAxis: one click creates the
// REVOLUTION_AXIS_PLACEMENT and poses the base map in 3D). Drawing an axis on
// a horizontal plan is the « Axe de révolution » command.
export default {
  key: "PLACE_REVOLUTION_AXIS",
  usesSelection: false,
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
      const active =
        isRevolutionAxisPlaceDrawingMode(ctx.enabledDrawingMode) ||
        isRevolutionAxisSectionDrawingMode(ctx.enabledDrawingMode);
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
};
