// « Couper une surface » tool group (2D editor): its tools (segment,
// polyline) are DRAWING_TOOLS_BY_TYPE.SURFACE_CUT. They borrow the
// POLYLINE_SEGMENT / POLYLINE_CLICK interaction modes, so the group is
// recognized from the draft type, not from enabledDrawingMode.
export const SURFACE_CUT_TOOL_TYPE = "SURFACE_CUT";

export function isSurfaceCutDraft(newAnnotation) {
  return newAnnotation?.type === SURFACE_CUT_TOOL_TYPE;
}
