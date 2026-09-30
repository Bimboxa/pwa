import {
  DEFAULT_NAVIGATION_PRESET,
  NAVIGATION_PRESETS,
} from "Features/threedEditor/constants/navigationPresets";

// Resolves the action ("ROTATE" | "TRUCK" | "DOLLY" | "NONE") of each mouse
// button for a navigation preset, given the modifier keys currently held.
// `modifierState` is any object carrying the altKey / ctrlKey / metaKey /
// shiftKey flags (a KeyboardEvent, a PointerEvent or a plain object).
export default function resolveNavigationMouseActions(
  presetKey,
  modifierState
) {
  const preset =
    NAVIGATION_PRESETS[presetKey] ??
    NAVIGATION_PRESETS[DEFAULT_NAVIGATION_PRESET];

  const modifier = preset.modifiers.find(({ keys }) =>
    keys.some((key) => modifierState?.[key] === true)
  );

  return { ...preset.base, ...modifier?.overrides };
}
