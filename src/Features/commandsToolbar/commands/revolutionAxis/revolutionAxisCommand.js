import { Adjust } from "@mui/icons-material";

import ButtonRevolutionAxis from "./ButtonRevolutionAxis";
import {
  isRevolutionAxisDrawingMode,
  startDrawRevolutionAxis,
} from "./startRevolutionAxisTools";
import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
  getDrawToolsGate,
} from "../../utils/drawToolCommandState";

// « Axe de révolution » (A — Features/revolutionAxes): draws a new axis on a
// horizontal plan (centre, then radius + direction) or on a horizontal base
// map plane of the 3D editor. On a VERTICAL base map (2D) an axis cannot be
// authored: the button drops an EXISTING axis of the scope instead (its Button
// lists them) and the hotkey yields. The axis belongs to the base map + the
// scope, not to a listing (Dessin module only).
export default {
  key: "REVOLUTION_AXIS",
  label: "Axe de révolution",
  Icon: Adjust,
  hotkey: {
    key: "a",
    plainOnly: true,
    // Smart detect owns "a" (pattern detection); a vertical base map drops
    // an axis instead of drawing one (menu).
    yieldWhen: (state, ctx) =>
      ctx.smartDetectEnabled || (!ctx.isThreedEditor && ctx.isVerticalBaseMap),
  },
  Button: ButtonRevolutionAxis,
  getState(ctx) {
    if (ctx.viewerKey !== "MAP") {
      return { enabled: false, reason: "Réservé au module Dessin" };
    }
    const gate = getDrawToolsGate(ctx);
    if (gate) return gate;
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (ctx.enabledDrawingMode) {
      const active = isRevolutionAxisDrawingMode(ctx.enabledDrawingMode);
      return active
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
  // Draws a new axis (plan / 3D). The vertical-base-map placement goes
  // through the Button (startPlaceRevolutionAxis).
  run(ctx, { dispatch }) {
    startDrawRevolutionAxis(dispatch);
  },
};
