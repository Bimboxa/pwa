import {
  ALL_EDITORS,
  UNAVAILABLE_IN_EDITOR_REASON,
} from "../constants/commandEditors";

export const DISABLED_STATE = Object.freeze({ enabled: false });

// Resolved state of a command for the current context — the ONE truth the
// toolbar button, the group menus and the hotkey listener share:
//   { enabled: boolean, reason?: string, active?: boolean }
// The editor gate (command.editors) is applied here so every command file
// only describes its own conditions.
export default function getCommandState(command, ctx) {
  if (!ctx) return DISABLED_STATE;
  const editors = command.editors ?? ALL_EDITORS;
  if (!editors.includes(ctx.editor)) {
    return {
      enabled: false,
      reason: UNAVAILABLE_IN_EDITOR_REASON[ctx.editor],
    };
  }
  try {
    const state = command.getState?.(ctx);
    if (!state) return DISABLED_STATE;
    return state;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(
        `[commandsToolbar] getState of ${command.key} threw`,
        error
      );
    }
    return DISABLED_STATE;
  }
}
