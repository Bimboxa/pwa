// Mouse navigation presets of the 3D editor — app-level device preference
// (`state.threedEditor.navigationPreset`, localStorage). Actions are
// camera-controls ACTION names kept as plain strings so this file stays free
// of any three.js dependency (shared by ControlsManager and the config UI).
//
// - `base`: action of each mouse button with no modifier key held.
// - `modifiers`: ordered list; the first entry with one of its `keys` held
//   (KeyboardEvent / PointerEvent flags) overrides the listed buttons.
//
// The right button never maps to NONE: camera-controls only cancels the
// native context menu when `mouseButtons.right !== NONE` (macOS Ctrl+click
// fires `contextmenu`). Shift + left-drag stays the lasso in every preset, so
// no preset binds Shift on the left button.
export const NAVIGATION_PRESET = {
  STANDARD: "STANDARD",
  ISO_2D: "ISO_2D",
  SKETCHUP: "SKETCHUP",
};

export const DEFAULT_NAVIGATION_PRESET = NAVIGATION_PRESET.STANDARD;

export const NAVIGATION_PRESETS = {
  [NAVIGATION_PRESET.STANDARD]: {
    base: { left: "ROTATE", middle: "DOLLY", right: "TRUCK" },
    // Option(Alt) + left-drag = pan (right-drag is awkward on a trackpad).
    modifiers: [{ keys: ["altKey"], overrides: { left: "TRUCK" } }],
  },
  // Same buttons as the 2D editor: left-drag pans. Orbit = middle-drag or
  // Ctrl/Cmd + drag. Ctrl also remaps the right button: on macOS some
  // browsers report Ctrl+click as a right-button press.
  [NAVIGATION_PRESET.ISO_2D]: {
    base: { left: "TRUCK", middle: "ROTATE", right: "TRUCK" },
    modifiers: [
      {
        keys: ["ctrlKey", "metaKey"],
        overrides: { left: "ROTATE", right: "ROTATE" },
      },
    ],
  },
  // SketchUp: middle-drag orbits, Shift + middle-drag pans, the left button
  // belongs to the tools / selection.
  [NAVIGATION_PRESET.SKETCHUP]: {
    base: { left: "NONE", middle: "ROTATE", right: "TRUCK" },
    modifiers: [{ keys: ["shiftKey"], overrides: { middle: "TRUCK" } }],
  },
};

// Ordered options consumed by the Configuration page (SectionNavigationPreset).
export const NAVIGATION_PRESET_OPTIONS = [
  {
    key: NAVIGATION_PRESET.STANDARD,
    label: "Standard",
    description:
      "Orbite : clic gauche + glisser · Pan : clic droit ou Alt + clic gauche · Zoom : molette",
  },
  {
    key: NAVIGATION_PRESET.ISO_2D,
    label: "Iso 2D + orbite",
    description:
      "Pan : clic gauche + glisser, comme en 2D · Orbite : clic molette ou Ctrl + clic gauche · Zoom : molette",
  },
  {
    key: NAVIGATION_PRESET.SKETCHUP,
    label: "Iso SketchUp",
    description:
      "Orbite : clic molette + glisser · Pan : Maj + clic molette ou clic droit · Zoom : molette · Clic gauche réservé aux outils",
  },
];

export function isNavigationPreset(key) {
  return Object.hasOwn(NAVIGATION_PRESETS, key);
}
