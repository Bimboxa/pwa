// Keyboard shortcuts for the free annotation rows ("Ligne" / "Polygone").
// Single source of truth shared by the row badge (PopperMapListings) and the
// global hotkey hook (useFreeAnnotationHotkeys), so the displayed key and the
// active binding can never drift.
export const FREE_ANNOTATION_SHORTCUT_BY_SHAPE = {
  POLYLINE: "L",
  POLYGON: "P",
};

// Returns the uppercase shortcut letter for a free-annotation template, or null.
export function getFreeAnnotationShortcut(template) {
  if (!template?.isFreeAnnotation) return null;
  return FREE_ANNOTATION_SHORTCUT_BY_SHAPE[template.drawingShape] ?? null;
}
