// Classic dashed pattern for DASHED strokes: dash = 3 × stroke width,
// gap = 2 × stroke width, floored so thin strokes (1 px lines, the 0.5 px
// POLYGON outline) keep readable dashes instead of a dense dotted look.
//
// The value is expressed in the same unit as `strokeWidth`:
// - PX unit (`vector-effect: non-scaling-stroke`): screen px, so the pattern
//   stays constant on screen whatever the zoom, like the stroke width.
// - CM unit (stroke scales with zoom): image px, so the pattern grows with
//   the zoom together with the stroke, like a CAD plot.
export default function getStrokeDasharray(strokeWidth) {
  const w = Number(strokeWidth) || 1;
  return `${Math.max(3 * w, 6)} ${Math.max(2 * w, 4)}`;
}
