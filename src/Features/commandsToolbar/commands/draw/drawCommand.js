import { Draw } from "@mui/icons-material";

import TEMPLATELESS_DRAWING_SHAPES from "Features/annotations/constants/templatelessDrawingShapes.jsx";
import { DEFAULT_TEMPLATELESS_DRAWING_SHAPE } from "Features/annotations/utils/templatelessAnnotations";
import startTemplatelessDraw, {
  THREED_DRAWING_SHAPES,
} from "Features/mapEditor/utils/startTemplatelessDraw";

import {
  DRAW_IN_PROGRESS_REASON,
  TOOL_IN_PROGRESS_REASON,
  getDrawToolsGate,
} from "../../utils/drawToolCommandState";

// « Dessin » (D): draw an annotation with no template nor listing
// (templateless draft). Variants = the annotation types of the tool; in the 3D
// editor only lines, surfaces and cotes (face drawing).
function getShapes(ctx) {
  return ctx.isThreedEditor
    ? TEMPLATELESS_DRAWING_SHAPES.filter((shape) =>
        THREED_DRAWING_SHAPES.includes(shape.key)
      )
    : TEMPLATELESS_DRAWING_SHAPES;
}

export default {
  key: "DRAW",
  label: "Dessin",
  Icon: Draw,
  hotkey: { key: "d" },
  variants: (ctx) =>
    getShapes(ctx).map((shape) => ({
      key: shape.key,
      label: shape.label,
      icon: shape.icon,
    })),
  getActiveVariant: (ctx) => {
    const shapes = getShapes(ctx);
    const shape =
      shapes.find((s) => s.key === ctx.templatelessDrawingShape) ??
      shapes.find((s) => s.key === DEFAULT_TEMPLATELESS_DRAWING_SHAPE) ??
      shapes[0];
    return shape
      ? { key: shape.key, label: shape.label, icon: shape.icon }
      : null;
  },
  getState(ctx) {
    // Templateless annotations belong to a scope of the Dessin module, never
    // to the ZONES / business-objects flows.
    if (ctx.viewerKey !== "MAP") {
      return { enabled: false, reason: "Réservé au module Dessin" };
    }
    const gate = getDrawToolsGate(ctx);
    if (gate) return gate;
    if (ctx.viewerMode) return { enabled: false, reason: ctx.readOnlyReason };
    if (ctx.interactionMode !== "DRAW" && ctx.interactionMode != null) {
      return { enabled: false, reason: "Disponible en mode Dessin" };
    }
    if (!ctx.selectedScopeId) {
      return { enabled: false, reason: "Sélectionnez un plan de repérage" };
    }
    if (ctx.enabledDrawingMode) {
      return ctx.isTemplatelessDraft
        ? { enabled: true, active: true }
        : { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
    }
    if (ctx.activeThreedTool) {
      return { enabled: false, reason: TOOL_IN_PROGRESS_REASON };
    }
    return { enabled: true };
  },
  run(ctx, { dispatch, store }, variantKey) {
    startTemplatelessDraw(dispatch, store.getState(), variantKey, {
      threed: ctx.isThreedEditor,
    });
  },
};
