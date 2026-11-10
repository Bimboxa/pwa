// Side of a prism a height cut applies to (a flat surface has one sheet only:
// the delta moves it whatever the side).
export const HEIGHT_CUT_SIDE_TOP = "TOP";
export const HEIGHT_CUT_SIDE_BOTTOM = "BOTTOM";

export const HEIGHT_CUT_DEFAULT_DELTA_M = 0.2;

// Selectable parts: `{annotationId}::HEIGHT_FACE::{faceKey}` (a face delimited
// by the traces) and `{annotationId}::HEIGHT_CUT::{index}` (a trace).
export const HEIGHT_FACE_PART_TYPE = "HEIGHT_FACE";
export const HEIGHT_CUT_PART_TYPE = "HEIGHT_CUT";

// "+0.2m" / "-0.2m" (centimeter precision, no trailing zeros).
export function formatHeightCutDelta(delta) {
  const value = Math.round((Number(delta) || 0) * 100) / 100;
  return `${value > 0 ? "+" : ""}${value}m`;
}
