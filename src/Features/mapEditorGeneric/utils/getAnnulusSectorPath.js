// Geometry helpers for the partial-revolution proxy node.
//
// Angles are measured in the baseMap IMAGE-PIXEL frame (origin top-left, y down),
// the same frame NodeClippingPlanStatic / NodeProxyRevolutionStatic operate in.
// `angleStart` → `angleEnd` go COUNTER-CLOCKWISE in math terms but, because the
// pixel y axis points down, they read clockwise on screen. The KEPT material is
// the arc swept from angleStart to angleEnd (increasing angle), the "mouth" is
// the complementary wedge.

const TWO_PI = Math.PI * 2;

// Normalize a span to [0, 2π). A span of exactly 0 maps to a full turn so a
// degenerate (start === end) range still renders something sensible.
export function normalizeSpan(span) {
  let s = span % TWO_PI;
  if (s <= 0) s += TWO_PI;
  return s;
}

function polar(cx, cy, r, a) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * SVG path for an annulus sector (or a pie slice when rInner ≈ 0) spanning
 * angleStart → angleEnd (increasing angle, the kept material).
 *
 * @param {{x:number,y:number}} center
 * @param {number} rOuter
 * @param {number} rInner  inner radius (0 / near-0 → pie slice)
 * @param {number} angleStart radians
 * @param {number} angleEnd   radians
 */
export default function getAnnulusSectorPath(
  center,
  rOuter,
  rInner,
  angleStart,
  angleEnd
) {
  if (!center || !(rOuter > 0)) return "";
  const span = normalizeSpan(angleEnd - angleStart);
  const end = angleStart + span; // unwrapped end ≥ start
  const largeArc = span > Math.PI ? 1 : 0;
  // sweep=1 → positive-angle (CCW in math frame) direction for the outer arc.
  const oStart = polar(center.x, center.y, rOuter, angleStart);
  const oEnd = polar(center.x, center.y, rOuter, end);

  const hasHole = rInner > Math.max(1, rOuter * 0.02);

  if (!hasHole) {
    // Pie slice: center → outer arc → back to center.
    return [
      `M ${center.x} ${center.y}`,
      `L ${oStart.x} ${oStart.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
      "Z",
    ].join(" ");
  }

  // Annulus sector: outer arc (CCW) → inner arc back (CW).
  const iStart = polar(center.x, center.y, rInner, angleStart);
  const iEnd = polar(center.x, center.y, rInner, end);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

export { polar };
