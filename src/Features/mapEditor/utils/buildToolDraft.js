import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

// Opening (ouverture) draft colour — openings are drawn in red @ 0.8 opacity.
export const OPENING_COLOR = "#ff0000";

// Revolution helper types are standalone annotations (no template / no entity),
// so we build a clean draft seeded only with their own style defaults instead
// of inheriting the previously-selected template's props.
const REVOLUTION_HELPER_TYPES = ["REVOLUTION_AXIS", "REVOLUTION_POINT"];

// Build the next `newAnnotation` draft when (re)selecting a cut / split tool.
//
// For opening tools built from a centerline (CUT_POLYLINE / CUT_STRIP …) we keep
// the real annotation type (POLYLINE / STRIP) so the drawing experience matches
// a normal polyline / stripe, and seed the opening style + the remembered line
// width (`openingDefaults`, defaulting to 20cm). For the direct opening tools
// (CUT_CLICK / CUT_RECTANGLE / CUT_CIRCLE) and any other tool, `isOpening` is
// cleared.
export default function buildToolDraft(newAnnotation, tool, openingDefaults) {
  // Standalone revolution helpers: start from a clean draft so no stale
  // template/entity association or inherited style leaks in.
  if (REVOLUTION_HELPER_TYPES.includes(tool.annotationType)) {
    return {
      type: tool.annotationType,
      ...getDefaultsForShape(tool.annotationType),
    };
  }

  const base = { ...newAnnotation, type: tool.annotationType };
  if (tool.isOpening) {
    base.isOpening = true;
    base.strokeColor = OPENING_COLOR;
    base.fillColor = OPENING_COLOR;
    base.strokeWidth = openingDefaults?.strokeWidth ?? 20;
    base.strokeWidthUnit = openingDefaults?.strokeWidthUnit ?? "CM";
  } else {
    delete base.isOpening;
  }
  return base;
}
