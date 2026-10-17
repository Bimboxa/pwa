import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { EDITOR_2D } from "../constants/commandEditors";
import { DRAW_IN_PROGRESS_REASON } from "./drawToolCommandState";
import { getSingleAnnotationState } from "./selectionCommandState";

// Command drawing a line INSIDE the selected annotation (guide line, iso
// height line, profile line, layout line — Features/annotations): toggles the
// `drawingMode` of the 2D InteractionLayer, whose branch commits the drawn
// polyline onto the selected annotation (no newAnnotation draft). Active
// while its mode is armed (the button / Escape disarm it); another armed
// draw disables it.
export default function createPolygonLineCommand({
  key,
  label,
  Icon,
  drawingMode,
  types,
  typesReason,
  extraCheck,
}) {
  return {
    key,
    label,
    Icon,
    editors: [EDITOR_2D],
    getState(ctx) {
      if (ctx.enabledDrawingMode === drawingMode) {
        return { enabled: true, active: true };
      }
      const state = getSingleAnnotationState(ctx, types, typesReason);
      if (!state.enabled) return state;
      const extra = extraCheck?.(ctx);
      if (extra) return extra;
      if (ctx.enabledDrawingMode) {
        return { enabled: false, reason: DRAW_IN_PROGRESS_REASON };
      }
      return { enabled: true };
    },
    run(ctx, { dispatch }) {
      dispatch(
        setEnabledDrawingMode(
          ctx.enabledDrawingMode === drawingMode ? null : drawingMode
        )
      );
    },
  };
}
