// LINEAR_LAYOUT (calepinage linéaire) — shared bar-distribution math.
//
// Single source of truth for the bar positions along the guide segment, used
// by both NodeLinearLayoutStatic (in px) and getAnnotationQties (in meters) so
// the rendered ticks and the computed quantities can never diverge.
//
// The distribution rule (layoutAlign) anchors the bar grid on the segment:
//   - LEFT:   first bar at the start point, then every `spacing`.
//   - RIGHT:  last bar at the end point, then every `spacing` backwards.
//   - CENTER: the n-bar grid is centered on the segment.
// n is the max number of positions at pitch `spacing` fitting in `length`,
// endpoints inclusive: n = floor(length / spacing) + 1.

// Degenerate spacing on a long segment must not freeze the SVG render.
const MAX_TICKS = 2000;

// Spacing between two bars in METERS, from the annotation density props.
// densityMode "SPACING": densityValue is a spacing in cm.
// densityMode "PER_METER": densityValue is a number of bars per meter.
export function getLinearLayoutSpacing(annotation) {
  const { densityMode = "SPACING", densityValue } = annotation ?? {};
  const value = parseFloat(densityValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  return densityMode === "PER_METER" ? 1 / value : value / 100;
}

// Bar offsets from the segment start, sorted ascending, in the same unit as
// `length` / `spacing` (px or meters).
export function getLinearLayoutTickOffsets({ length, spacing, align }) {
  if (!(spacing > 1e-9) || !(length > 0)) return [];

  let n = Math.floor(length / spacing + 1e-6) + 1;
  n = Math.min(n, MAX_TICKS);

  let t0 = 0;
  if (align === "RIGHT") t0 = length - (n - 1) * spacing;
  else if (align !== "LEFT") t0 = (length - (n - 1) * spacing) / 2; // CENTER

  const offsets = [];
  for (let k = 0; k < n; k++) offsets.push(t0 + k * spacing);
  return offsets;
}
