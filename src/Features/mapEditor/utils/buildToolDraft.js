import { SURFACE_CUT_TOOL_TYPE } from "Features/surfaceCut/utils/surfaceCutTools";
import { FACE_CUT_TOOL_TYPE } from "Features/threedFaceCut/utils/faceCutTools";

import { isTransformToolMode } from "Features/annotationTransform/utils/transformToolModes";

import { getDrawingToolTypeByKey } from "../constants/drawingTools.jsx";

// Opening (ouverture) draft colour — openings are drawn in red @ 0.8 opacity.
export const OPENING_COLOR = "#ff0000";

// « Couper une surface » trace colour.
export const SURFACE_CUT_COLOR = "#e65100";

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
  // Surface cut trace: a thin solid line, with no drawing shape left over
  // from a previous draw (the toolbar / letter hotkeys would offer its tools).
  if (tool.annotationType === SURFACE_CUT_TOOL_TYPE) {
    base.strokeColor = SURFACE_CUT_COLOR;
    base.fillColor = SURFACE_CUT_COLOR;
    base.strokeWidth = 2;
    base.strokeWidthUnit = "PX";
    base.strokeOpacity = 1;
    delete base.strokeType;
    delete base.drawingShape;
  }
  // « Déplacer » / « Tourner » draw nothing: no drawing shape left over from
  // a previous draw (its letter hotkeys would switch tools).
  if (isTransformToolMode(tool.annotationType)) delete base.drawingShape;
  // "Coupe face" (3D): its own tool letters (K / L / R / H / V), no drawing
  // shape left over either.
  if (tool.annotationType === FACE_CUT_TOOL_TYPE) delete base.drawingShape;
  return base;
}
