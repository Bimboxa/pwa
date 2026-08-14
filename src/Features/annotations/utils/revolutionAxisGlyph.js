// Shared SVG helpers for the plan-view REVOLUTION_AXIS glyph, used by both the
// committed node (NodeRevolutionAxisStatic) and the live drawing preview
// (DrawingLayer) so the two renders can never diverge.

// Half-disc arc between the two (antipodal) diameter ends: the sweep flag alone
// picks which half is drawn.
//
// Which flag is the ORANGE side is a CONSTANT, not data-dependent. Writing
// d = dirPx and o = orangePx = (d.y, −d.x), their 2D cross product in SVG's
// y-down frame is d.x·o.y − d.y·o.x = −(d.x² + d.y²) = −1 < 0, i.e. the orange
// side is always the negative (sweep = 0) side, whatever the direction — and
// `invertHalf` is already folded into dirPx, so it swaps the halves for free.
export const SWEEP_ORANGE = 0;
export const SWEEP_BLACK = 1;

export const halfArcPath = (from, to, r, sweep) =>
  `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweep} ${to.x} ${to.y}`;
