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

// ---------------------------------------------------------------------------
// Contour of the plan-view axis, split into VISIBLE / HIDDEN arcs.
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;

const mod2Pi = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

// How far the blue cut axis (and its two rotation handles) overshoots the
// circle, as a factor of the radius. Shared by the renderer and the handle
// drag math (applyDeltaPosToAnnotation).
export const CUT_AXIS_OVERSHOOT = 1.35;

/**
 * Contour arcs of a revolution axis, in the plan LOCAL frame (radians, y up,
 * CCW) — pure, node-testable.
 *
 * - The contour is the full circle, or the kept sector of a partial
 *   revolution (CCW from angleStart to angleEnd, same convention as
 *   getRevolutionPhi).
 * - The 3D half-view cuts along the diameter (direction `theta`, invertHalf
 *   folded in) and shows the half on its +90°-CCW side (the "orange" side of
 *   getRevolutionAxisPlanFrame, i.e. behind the placed vertical base map):
 *   plan angles in [theta, theta + π]. Half-view off → everything is visible.
 *
 * Every returned arc spans at most π (so the SVG large-arc flag is never
 * needed, and a full circle is never a degenerate single arc).
 *
 * @returns {{from:number, to:number, visible:boolean}[]} CCW, `to > from`.
 */
export function getRevolutionAxisContourArcs({
  theta = 0,
  halfView = true,
  partial = false,
  angleStart = 0,
  angleEnd = 0,
}) {
  const start = partial ? angleStart : theta;
  let span = partial ? mod2Pi(angleEnd - angleStart) : TWO_PI;
  if (span <= 1e-9) span = TWO_PI;
  const end = start + span;

  const isVisible = (a) => !halfView || mod2Pi(a - theta) < Math.PI;

  // Breakpoints: the contour ends, the two ends of the cut diameter that fall
  // inside it, then a midpoint in any piece still wider than π.
  const cuts = [start, end];
  if (halfView) {
    for (const base of [theta, theta + Math.PI]) {
      const a = start + mod2Pi(base - start);
      if (a > start + 1e-9 && a < end - 1e-9) cuts.push(a);
    }
  }
  cuts.sort((a, b) => a - b);

  const arcs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i];
    const to = cuts[i + 1];
    if (to - from <= 1e-9) continue;
    const visible = isVisible((from + to) / 2);
    if (to - from > Math.PI + 1e-9) {
      const mid = (from + to) / 2;
      arcs.push({ from, to: mid, visible }, { from: mid, to, visible });
    } else {
      arcs.push({ from, to, visible });
    }
  }
  return arcs;
}

// Pixel position (SVG, y down) of a plan LOCAL angle on the circle.
export const angleToPx = (centerPx, radiusPx, angle) => ({
  x: centerPx.x + radiusPx * Math.cos(angle),
  y: centerPx.y - radiusPx * Math.sin(angle),
});

// SVG path of a CCW (local frame) arc of at most π. Local CCW is
// counter-clockwise on screen too (y is mirrored, so is the angle): sweep 0.
export const contourArcPath = (centerPx, radiusPx, arc) => {
  const a = angleToPx(centerPx, radiusPx, arc.from);
  const b = angleToPx(centerPx, radiusPx, arc.to);
  return `M ${a.x} ${a.y} A ${radiusPx} ${radiusPx} 0 0 0 ${b.x} ${b.y}`;
};
