import { createSlice } from "@reduxjs/toolkit";

import {
  loadCommandsToolbarLayout,
  saveCommandsToolbarLayout,
} from "./services/commandsToolbarLocalStorage";
import { DEFAULT_SHORTCUT_COMMAND_KEYS } from "./constants/defaultShortcuts";

// Layout state of the unified commands toolbar (CommandsToolbar), hydrated
// from localStorage and written back on every change:
// - dock: "TOP" | "BOTTOM" | "LEFT" (in-flow strip reserving its space on
//   that edge of the editors area) | "FLOATING" (absolute layer over the
//   editors, dragged freely). Default LEFT (vertical strip against the left
//   edge) until the user moves it; a floating toolbar paints over the edit
//   poppers of the editors (PanelShowable is a stacking context).
// - position: floating offset in px from the editors area's top-left corner.
// - lastUsedByGroup: command (or variant) key shown as the primary slot of
//   every UI group of constants/toolbarLayout.js.
// - shortcutCommandKeys: ordered command keys of the right-click shortcuts
//   menu of the editors (MenuCommandShortcuts), chosen in the « Commandes »
//   dialog (commandsDialogOpen — not persisted).
// - hideDisabledCommands: the toolbar only shows the commands available in
//   the current context (selection, 2D vs 3D editor) instead of greying the
//   others. Default true; option of the « Commandes » dialog.
const persisted = loadCommandsToolbarLayout();

const initialState = {
  dock: persisted.dock ?? "LEFT",
  position: persisted.position ?? { x: 24, y: 24 },
  lastUsedByGroup: persisted.lastUsedByGroup ?? {},
  shortcutCommandKeys:
    persisted.shortcutCommandKeys ?? DEFAULT_SHORTCUT_COMMAND_KEYS,
  hideDisabledCommands: persisted.hideDisabledCommands ?? true,
  commandsDialogOpen: false,
};

function uniqueKeys(keys) {
  return [...new Set((keys ?? []).filter((k) => typeof k === "string"))];
}

const commandsToolbarSlice = createSlice({
  name: "commandsToolbar",
  initialState,
  reducers: {
    setCommandsToolbarDock: (state, action) => {
      state.dock = action.payload;
      saveCommandsToolbarLayout({ dock: state.dock });
    },
    setCommandsToolbarPosition: (state, action) => {
      const { x, y } = action.payload ?? {};
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      state.position = { x, y };
      saveCommandsToolbarLayout({ position: state.position });
    },
    setCommandsToolbarLastUsed: (state, action) => {
      const { groupKey, commandKey } = action.payload ?? {};
      if (!groupKey || !commandKey) return;
      state.lastUsedByGroup[groupKey] = commandKey;
      saveCommandsToolbarLayout({ lastUsedByGroup: state.lastUsedByGroup });
    },
    // Whole ordered list (reorder / reset).
    setShortcutCommandKeys: (state, action) => {
      state.shortcutCommandKeys = uniqueKeys(action.payload);
      saveCommandsToolbarLayout({
        shortcutCommandKeys: state.shortcutCommandKeys,
      });
    },
    // Check / uncheck one command: appended at the end / removed.
    toggleShortcutCommand: (state, action) => {
      const key = action.payload;
      if (!key) return;
      state.shortcutCommandKeys = state.shortcutCommandKeys.includes(key)
        ? state.shortcutCommandKeys.filter((k) => k !== key)
        : [...state.shortcutCommandKeys, key];
      saveCommandsToolbarLayout({
        shortcutCommandKeys: state.shortcutCommandKeys,
      });
    },
    setHideDisabledCommands: (state, action) => {
      state.hideDisabledCommands = Boolean(action.payload);
      saveCommandsToolbarLayout({
        hideDisabledCommands: state.hideDisabledCommands,
      });
    },
    setCommandsDialogOpen: (state, action) => {
      state.commandsDialogOpen = Boolean(action.payload);
    },
  },
});

export const {
  setCommandsToolbarDock,
  setCommandsToolbarPosition,
  setCommandsToolbarLastUsed,
  setShortcutCommandKeys,
  toggleShortcutCommand,
  setHideDisabledCommands,
  setCommandsDialogOpen,
} = commandsToolbarSlice.actions;

export const selectCommandsToolbarDock = (s) => s.commandsToolbar.dock;
export const selectCommandsToolbarPosition = (s) => s.commandsToolbar.position;
export const selectCommandsToolbarLastUsedByGroup = (s) =>
  s.commandsToolbar.lastUsedByGroup;
export const selectShortcutCommandKeys = (s) =>
  s.commandsToolbar.shortcutCommandKeys;
export const selectHideDisabledCommands = (s) =>
  s.commandsToolbar.hideDisabledCommands;
export const selectCommandsDialogOpen = (s) =>
  s.commandsToolbar.commandsDialogOpen;

export default commandsToolbarSlice.reducer;
