import { EDITOR_2D } from "../constants/commandEditors";
import { getSelectionGate } from "./selectionCommandState";

// Session-wide view toggle of the 2D editor (mapEditorSlice flags: cotes,
// segment drag, angle padlock — the former overlay row of the selected
// annotation). Enabled with a selection in the 2D editor; `active` mirrors the
// flag; `extraCheck(ctx)` adds a condition (scale…).
export default function createViewToggleCommand({
  key,
  label,
  Icon,
  getValue,
  setValue,
  extraCheck,
}) {
  return {
    key,
    label,
    Icon,
    editors: [EDITOR_2D],
    getState(ctx) {
      const gate = getSelectionGate(ctx);
      if (gate) return gate;
      const extra = extraCheck?.(ctx);
      if (extra) return extra;
      return { enabled: true, active: Boolean(getValue(ctx)) };
    },
    run(ctx, { dispatch }) {
      dispatch(setValue(!getValue(ctx)));
    },
  };
}
