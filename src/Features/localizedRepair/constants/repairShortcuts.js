// Single source of truth for the localized-repair modes, shared by the
// DrawingHelper UI (PopperDrawingHelper / SectionShortcutHelpers) and the
// keydown handler in InteractionLayer.

export const REPAIR_MODES = [
  { mode: "AUTO", label: "Auto", shortcut: "A" },
  { mode: "L", label: "Jonction L", shortcut: "L" },
  { mode: "T", label: "Jonction T", shortcut: "T" },
  { mode: "SMOOTH", label: "Lissage", shortcut: "S" },
];

// Lowercased key → repair mode. Used by the keydown switch (gated to the
// LOCALIZED_REPAIR drawing mode).
export const REPAIR_KEY_TO_MODE = {
  a: "AUTO",
  l: "L",
  t: "T",
  s: "SMOOTH",
};
