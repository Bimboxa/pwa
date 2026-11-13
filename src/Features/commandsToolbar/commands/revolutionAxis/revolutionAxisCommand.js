import { Adjust } from "@mui/icons-material";

import ButtonRevolutionAxis from "./ButtonRevolutionAxis";
import {
  isRevolutionAxisDrawDrawingMode,
  startDrawRevolutionAxis,
} from "./startRevolutionAxisTools";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
  getDrawToolsGate,
} from "../../utils/drawToolCommandState";

export const HORIZONTAL_BASE_MAP_ONLY_REASON =
  "Réservé aux plans horizontaux — sur un plan de coupe, utilisez « Axe sur plan de coupe »";

// « Axe de révolution » (A — Features/revolutionAxes): draws a new axis on a
// horizontal plan (centre, then radius + direction) or on a horizontal base
// map plane of the 3D editor. On a VERTICAL base map (2D) an axis cannot be
// authored: the command is disabled there, posing an EXISTING axis of the
// scope is the « Axe sur plan de coupe » command (PLACE_REVOLUTION_AXIS). The
// axis belongs to the base map + the scope, not to a listing (Dessin module
// only).
export default {
  key: "REVOLUTION_AXIS",
  usesSelection: false,
  label: "Axe de révolution",
  Icon: Adjust,
  hotkey: {
    key: "a",
    plainOnly: true,
    // Smart detect owns "a" (pattern detection).
    yieldWhen: (state, ctx) => ctx.smartDetectEnabled,
  },
  Button: ButtonRevolutionAxis,
  getState(ctx) {
    if (ctx.viewerKey !== "MAP") {
      return { enabled: false, reason: "Réservé au module Dessin" };
    }
    const gate = getDrawToolsGate(ctx);
    if (gate) return gate;
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (!ctx.isThreedEditor && ctx.isVerticalBaseMap) {
      return { enabled: false, reason: HORIZONTAL_BASE_MAP_ONLY_REASON };
    }
    if (ctx.enabledDrawingMode) {
      const active = isRevolutionAxisDrawDrawingMode(ctx.enabledDrawingMode);
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
  // Draws a new axis (plan / 3D).
  run(ctx, { dispatch }) {
    startDrawRevolutionAxis(dispatch);
  },
};
