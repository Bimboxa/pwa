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
  k: "SEGMENT", // 2-point segment tool (auto-commit; SEGMENT_SNAP detection)
  a: "ARC", // "Arc de cercle" — only resolves for shapes that have an ARC tool
  // (POLYLINE). "A" also doubles as the global smart-detect trigger; the hook
  // yields A to smart-detect when that switch is active (see useDrawingToolHotkeys).
  p: "MESH_BRUSH", // « Pinceau » (3D editor only). In 2D no tool of the group
  // has this behavior, so the letter falls through to the smart-detect zoom
  // (InteractionLayer). The walk-mode P toggle (useWalkMode) already yields
  // the key while a drawing mode is armed.
  // Note: "T" is intentionally NOT a tool shortcut — it is reserved for the
  // in-drawing "toggle last point to arc" action (InteractionLayer).
};

// Opening (CUT) direct-access hotkeys → CUT tool KEY (not behavior). Several CUT
// tools share the same `behavior` (e.g. CUT_CLICK and CUT_POLYLINE are both
// CLICK), so the opening shortcuts must target tool keys directly instead of
// resolving by behavior like the shape-group letters above.
export const OPENING_TOOL_HOTKEYS = {
  s: "CUT_CLICK", // surface clic-clic ("Polyligne fermée")
  r: "CUT_RECTANGLE",
  l: "CUT_POLYLINE", // centerline polyline → band
  k: "CUT_POLYLINE_SEGMENT", // centerline 2-click segment → band
  b: "CUT_STRIP", // bande
};

// "Coupe face" (FACE_CUT, 3D editor) direct-access hotkeys → tool KEY.
// Same scheme as the openings: the letters match the shape-group ones where
// a counterpart exists (K segment, L polyline, R rectangle), plus H / V for
// the axis cuts. Handled by useDrawingToolHotkeys while the group is armed.
export const FACE_CUT_TOOL_HOTKEYS = {
  k: "FACE_CUT_SEGMENT",
  l: "FACE_CUT_POLYLINE",
  r: "FACE_CUT_RECTANGLE",
  h: "FACE_CUT_HORIZONTAL",
  v: "FACE_CUT_VERTICAL",
};

// Uppercase badge letter of `tool` in a letter → tool key map, or null.
function getHotkeyForToolKey(map, tool) {
  if (!tool) return null;
  const hit = Object.entries(map).find(([, key]) => key === tool.key);
  return hit ? hit[0].toUpperCase() : null;
}

// Uppercase badge letter for a CUT tool, or null.
export function getOpeningHotkeyForTool(tool) {
  return getHotkeyForToolKey(OPENING_TOOL_HOTKEYS, tool);
}

// Uppercase badge letter for a FACE_CUT tool, or null.
export function getFaceCutHotkeyForTool(tool) {
  return getHotkeyForToolKey(FACE_CUT_TOOL_HOTKEYS, tool);
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
