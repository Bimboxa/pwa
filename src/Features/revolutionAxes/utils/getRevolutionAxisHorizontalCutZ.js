// Height of the axis line drawn in 3D when the axis has no height of its own
// (same default as createAnnotationObject3D's REVOLUTION_AXIS case).
const DEFAULT_AXIS_HEIGHT_M = 5;

// Altitude (metres above the base of the axis, along the axis) of the
// horizontal 3D cut of a revolution axis: the stored `horizontalCutZ`, or the
// mid-height of the axis when none was stored yet. Pure, import-free.
export default function getRevolutionAxisHorizontalCutZ(axis) {
  const stored = Number(axis?.horizontalCutZ);
  if (axis?.horizontalCutZ != null && Number.isFinite(stored))
    return Math.max(0, stored);
  const height = Number(axis?.height);
  return (height > 0 ? height : DEFAULT_AXIS_HEIGHT_M) / 2;
}
