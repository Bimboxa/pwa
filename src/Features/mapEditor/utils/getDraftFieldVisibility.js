import { getDrawingToolTypeByKey } from "../constants/drawingTools.jsx";

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

  const isToolGroup = isCuttingTool || isOpeningBand;
  const toolGroupType = isCuttingTool ? toolType : isOpeningBand ? "CUT" : null;

  // The Rampe tool drives its own geometry from two transient meter fields and
  // hides the generic height / offset / thickness fields.
  const isRampTool = enabledDrawingMode === "RAMP";

  const overrideFields = newAnnotation?.overrideFields;
  const isFieldOverridden = (field) =>
    Array.isArray(overrideFields) && overrideFields.includes(field);

  const showThickness =
    !isRampTool &&
    !isFieldOverridden("strokeWidth") &&
    ((!isToolGroup &&
      (drawingShape === "POLYLINE" || drawingShape === "OPENING")) ||
      isOpeningBand);
  const showOffset =
    !isToolGroup && !isRampTool && !isFieldOverridden("offsetZ");
  const showHeight =
    !isToolGroup && !isRampTool && !isFieldOverridden("height");
  const showWidth = drawingShape === "OPENING" && !isFieldOverridden("width");

  return {
    isCuttingTool,
    isOpeningBand,
    isToolGroup,
    toolGroupType,
    isRampTool,
    isFieldOverridden,
    showThickness,
    showOffset,
    showHeight,
    showWidth,
  };
}
