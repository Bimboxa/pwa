// Direct-access drawing-tool keyboard shortcuts.
//
// Lowercase letter → tool `behavior`. While a drawing tool is active but the
// FIRST point of the object has not been placed yet, pressing one of these
// letters switches to the first tool of the current shape group whose
// `behavior` matches. After the first point is placed, these letters yield
// priority back to the in-drawing shortcuts (smart-detect A/S, rectangle dims
// X/Y, paste I/R, repair L/T, …).
export const DRAWING_TOOL_HOTKEYS = {
  r: "RECTANGLE",
  l: "CLICK", // click / polyline tool ("Ligne")
  c: "CIRCLE",
  g: "SURFACE_DROP", // "Goutte d'eau" = Remplissage
  b: "STRIP", // "Bande"
  t: "SEGMENT", // "Trait" / segment (first SEGMENT-behavior tool of the group). Frees S for smart-detect "Au survol".
};

// Opening (CUT) direct-access hotkeys → CUT tool KEY (not behavior). Several CUT
// tools share the same `behavior` (e.g. CUT_CLICK and CUT_POLYLINE are both
// CLICK), so the opening shortcuts must target tool keys directly instead of
// resolving by behavior like the shape-group letters above.
export const OPENING_TOOL_HOTKEYS = {
  s: "CUT_CLICK", // surface clic-clic ("Polyligne fermée")
  r: "CUT_RECTANGLE",
  l: "CUT_POLYLINE", // centerline polyline → band
  b: "CUT_STRIP", // bande
};

// Uppercase badge letter for a CUT tool, or null.
export function getOpeningHotkeyForTool(tool) {
  if (!tool) return null;
  const hit = Object.entries(OPENING_TOOL_HOTKEYS).find(
    ([, key]) => key === tool.key
  );
  return hit ? hit[0].toUpperCase() : null;
}

// Uppercase letter to display for a tool WITHIN its group, or null. Only the
// tool actually targeted by the shortcut (the first of that `behavior` in the
// group) is badged, to stay consistent with the effective selection.
export function getHotkeyForToolInGroup(tool, tools) {
  if (!tool) return null;
  for (const [letter, behavior] of Object.entries(DRAWING_TOOL_HOTKEYS)) {
    if (tool.behavior !== behavior) continue;
    const first = tools.find((t) => t.behavior === behavior);
    if (first?.key === tool.key) return letter.toUpperCase();
  }
  return null;
}
