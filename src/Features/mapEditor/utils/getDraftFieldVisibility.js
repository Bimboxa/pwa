import { getDrawingToolTypeByKey } from "../constants/drawingTools.jsx";
import { isMeshBrushDrawingMode } from "Features/meshPaint/utils/meshBrushTools";
import {
  SURFACE_CUT_TOOL_TYPE,
  isSurfaceCutDraft,
} from "Features/surfaceCut/utils/surfaceCutTools";

// Which draft fields (thickness / offset / height / width) the drawing toolbar
// exposes for the current draft + active tool. Extracted from ToolbarDrawingDraft
// so the E / H keyboard shortcuts (InteractionLayer) gate on the exact same rules
// and can never capture a letter for a field that isn't shown.
//
// Pure function of (newAnnotation, enabledDrawingMode). Also returns the derived
// tool-group flags the toolbar itself needs, so both stay in one place.
export default function getDraftFieldVisibility(
  newAnnotation,
  enabledDrawingMode
) {
  const drawingShape = newAnnotation?.drawingShape;

  // A cutting tool (CUT / SPLIT_LINE / …) is active when the enabled drawing
  // mode maps back to one of the DRAWING_TOOLS_BY_TYPE groups.
  const toolType = getDrawingToolTypeByKey(enabledDrawingMode);
  const isCuttingTool = Boolean(toolType);

  // Opening (ouverture) tools drawn from a centerline reuse the POLYLINE / STRIP
  // interaction modes, so enabledDrawingMode is not a CUT_* key — they're
  // recognized via the draft's isOpening flag instead.
  const isOpeningBand =
    Boolean(newAnnotation?.isOpening) &&
    drawingShape !== "OPENING" &&
    (newAnnotation?.type === "POLYLINE" || newAnnotation?.type === "STRIP");

  // « Couper une surface » tools reuse the POLYLINE_SEGMENT / POLYLINE_CLICK
  // modes too: recognized via the draft type.
  const isSurfaceCut = isSurfaceCutDraft(newAnnotation);

  const isToolGroup = isCuttingTool || isOpeningBand || isSurfaceCut;
  const toolGroupType = isCuttingTool
    ? toolType
    : isOpeningBand
      ? "CUT"
      : isSurfaceCut
        ? SURFACE_CUT_TOOL_TYPE
        : null;

  // The Rampe tool drives its own geometry from two transient meter fields and
  // hides the generic height / offset / thickness fields.
  const isRampTool = enabledDrawingMode === "RAMP";

  // The « Pinceau » (3D) paints existing parts with the template itself: no
  // drawn geometry, so no draft field (nor colour — the paint takes the
  // template's) applies.
  const isMeshBrushTool = isMeshBrushDrawingMode(enabledDrawingMode);

  // Purely annotative shapes (callout bubble, free text) have no 3D body:
  // the Offset / height fields would be meaningless noise for them.
  const isAnnotativeShape =
    drawingShape === "DETAIL" ||
    drawingShape === "FREE_TEXT" ||
    drawingShape === "BASE_MAP_LINK";

  const overrideFields = newAnnotation?.overrideFields;
  const isFieldOverridden = (field) =>
    Array.isArray(overrideFields) && overrideFields.includes(field);

  const showThickness =
    !isRampTool &&
    !isMeshBrushTool &&
    !isFieldOverridden("strokeWidth") &&
    ((!isToolGroup &&
      (drawingShape === "POLYLINE" ||
        drawingShape === "CIRCULATION" ||
        drawingShape === "OPENING" ||
        drawingShape === "LINEAR_LAYOUT")) ||
      isOpeningBand);
  const showOffset =
    !isToolGroup &&
    !isRampTool &&
    !isMeshBrushTool &&
    !isAnnotativeShape &&
    !isFieldOverridden("offsetZ");
  const showHeight =
    !isToolGroup &&
    !isRampTool &&
    !isMeshBrushTool &&
    !isAnnotativeShape &&
    !isFieldOverridden("height");
  const showWidth =
    !isMeshBrushTool &&
    (drawingShape === "OPENING" || drawingShape === "LINEAR_LAYOUT") &&
    !isFieldOverridden("width");
  // "Couche" (material layer) toggle: plain STRIP drafts only (opening bands
  // are part of isToolGroup and excluded with the other generic fields).
  const showIsLayer =
    !isToolGroup &&
    !isRampTool &&
    !isMeshBrushTool &&
    newAnnotation?.type === "STRIP";

  // Text size (page pt) of a free text draft.
  const showFontSize =
    !isToolGroup &&
    !isMeshBrushTool &&
    drawingShape === "FREE_TEXT" &&
    !isFieldOverridden("fontSize");

  return {
    isCuttingTool,
    isOpeningBand,
    isToolGroup,
    toolGroupType,
    isRampTool,
    isMeshBrushTool,
    isFieldOverridden,
    showThickness,
    showOffset,
    showHeight,
    showWidth,
    showIsLayer,
    showFontSize,
  };
}
