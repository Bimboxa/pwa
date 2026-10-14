// Editor-aware drawing tool lists — pure, node-testable (relative `.js`
// imports only).
//
// A DRAWING_TOOLS entry may declare:
//   - `editor: "2D" | "3D"`: the only editor that offers it (none: both). The
//     "Coupe face" tools are 3D-only; the « Pinceau » (MESH_BRUSH) is offered
//     in BOTH editors (paints parts in 3D, converts / duplicates annotations
//     in 2D).
//   - `requiresTemplate: true`: never offered to a template-less draft (the
//     "Dessin" tool, hotkey D).
//   - `neverDefaultTool: true`: hidden from the template form's « Outil par
//     défaut » select (FormAnnotationTemplateVariantBlock) — a row click must
//     draw, not arm the brush.
//
// The editor defaults to "2D", so a caller that passes nothing (the template
// form's « Outil par défaut » select, the legacy 2D toolbar) never sees a
// 3D-only tool — it can never become a template's `defaultTool`.

import { isThreedFamilyViewerKey } from "../../viewers/utils/threedViewerKeys.js";

export const DRAWING_TOOLS_EDITOR_2D = "2D";
export const DRAWING_TOOLS_EDITOR_3D = "3D";

// Is `tool` offered in `editor` for a draft with / without template?
export function isDrawingToolAvailable(
  tool,
  { editor = DRAWING_TOOLS_EDITOR_2D, templateless = false } = {}
) {
  if (!tool) return false;
  if (tool.editor && tool.editor !== editor) return false;
  if (templateless && tool.requiresTemplate) return false;
  return true;
}

// Tools of `tools` offered in `editor` (order kept).
export function filterDrawingToolsForEditor(tools, options) {
  return (tools ?? []).filter((tool) => isDrawingToolAvailable(tool, options));
}

export default filterDrawingToolsForEditor;

// Active tool of a list: the first of `keys` (per-template selected tool,
// then template.defaultTool…) that BELONGS to `tools`, else the first tool.
// Membership matters: a 3D-only tool remembered in
// mapEditor.selectedToolKeyByTemplateId (shared by both editors) falls back
// to another tool in the 2D editor, and is picked again back in 3D. (The
// « Pinceau » is offered in both editors, so a brush remembered in 3D arms
// the 2D template brush on the next row click.)
export function pickDrawingTool(tools, keys = []) {
  const list = tools ?? [];
  for (const key of keys) {
    if (!key) continue;
    const tool = list.find((t) => t.key === key);
    if (tool) return tool;
  }
  return list[0] ?? null;
}

// Editor whose tools a drawing-tool list must offer. 3D-only tools are
// offered in the Dessin module ("MAP" in the left band) shown in its 3D
// editor only: the other modules displaying the 3D editor (Viewer, Maillage,
// Zones, Ouvrages…) keep the 2D list.
//   - moduleKey: s.viewers.selectedViewerKey
//   - effectiveViewerKey: selectEffectiveViewerKey(s)
export function getDrawingToolsEditor({ moduleKey, effectiveViewerKey } = {}) {
  return moduleKey === "MAP" && isThreedFamilyViewerKey(effectiveViewerKey)
    ? DRAWING_TOOLS_EDITOR_3D
    : DRAWING_TOOLS_EDITOR_2D;
}
