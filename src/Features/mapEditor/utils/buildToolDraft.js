import { getDrawingToolTypeByKey } from "../constants/drawingTools.jsx";

// Opening (ouverture) draft colour — openings are drawn in red @ 0.8 opacity.
export const OPENING_COLOR = "#ff0000";

// Build the next `newAnnotation` draft when (re)selecting a cut / split tool.
//
// For opening tools built from a centerline (CUT_POLYLINE / CUT_STRIP …) we keep
// the real annotation type (POLYLINE / STRIP) so the drawing experience matches
// a normal polyline / stripe, and seed the opening style + the remembered line
// width (`openingDefaults`, defaulting to 20cm). For the direct opening tools
// (CUT_CLICK / CUT_RECTANGLE / CUT_CIRCLE) and any other tool, `isOpening` is
// cleared.
export default function buildToolDraft(newAnnotation, tool, openingDefaults) {
  const base = { ...newAnnotation, type: tool.annotationType };
  // Tool groups (openings / splits) reuse the previous draft: it must not
  // keep the templateless flag of a previous "Dessin" draw.
  if (getDrawingToolTypeByKey(tool.key)) delete base.isTemplateless;
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
