// CIRCULATION arrow glyph, shared by the plan renderer and the legend icons.
// Each direction is a full arrow (shaft + head) pointing along x; with both
// directions the two arrows sit back to back, separated by a small gap.

export const CIRCULATION_ARROW_DEFAULT_LENGTH_PT = 24;
export const CIRCULATION_ARROW_DEFAULT_WIDTH_RATIO = 50;
export const CIRCULATION_ARROW_DEFAULT_OPACITY = 1;

// Proportions of one arrow, relative to its length.
const HEAD_LENGTH_RATIO = 14 / 23;
const GAP_RATIO = 4 / 23;
// Head height of the stand-alone glyph (no band width to follow).
export const CIRCULATION_ARROW_HEAD_HEIGHT_RATIO = 18 / 23;
// Shaft thickness relative to the head height.
const SHAFT_HEIGHT_RATIO = 1 / 3;

/**
 * SVG path of the glyph, centred on (0, 0), "right" pointing +x.
 *
 * @param {object} p
 * @param {number} p.length - length of ONE arrow (shaft + head).
 * @param {number} [p.headHeight] - full height of the head (across the band).
 * @param {boolean} [p.arrowRight=true]
 * @param {boolean} [p.arrowLeft=true]
 * @returns {string|null}
 */
export default function getCirculationArrowPath({
  length,
  headHeight,
  arrowRight = true,
  arrowLeft = true,
}) {
  if (!(length > 0) || (!arrowRight && !arrowLeft)) return null;

  const height =
    headHeight > 0 ? headHeight : length * CIRCULATION_ARROW_HEAD_HEIGHT_RATIO;
  const halfH = height / 2;
  const sh = (height * SHAFT_HEIGHT_RATIO) / 2;
  const head = length * HEAD_LENGTH_RATIO;
  const shaft = length - head;
  const both = arrowRight && arrowLeft;
  // Single arrow: centred on the anchor. Double: each arrow starts half a
  // gap away from the anchor.
  const baseX = both ? (length * GAP_RATIO) / 2 : -length / 2;

  const arrowPath = (sign) => {
    const x0 = sign * baseX;
    const x1 = sign * (baseX + shaft);
    const x2 = sign * (baseX + length);
    return (
      `M ${x0} ${-sh} L ${x1} ${-sh} L ${x1} ${-halfH} L ${x2} 0 ` +
      `L ${x1} ${halfH} L ${x1} ${sh} L ${x0} ${sh} Z`
    );
  };

  const parts = [];
  if (arrowRight) parts.push(arrowPath(1));
  if (arrowLeft) parts.push(arrowPath(-1));
  return parts.join(" ");
}

// Total span of the glyph along x (both arrows + gap when double).
export function getCirculationArrowSpan({ length, arrowRight, arrowLeft }) {
  const both = arrowRight !== false && arrowLeft !== false;
  return both ? 2 * length + length * GAP_RATIO : length;
}

// Glyph path fitted in a `span` wide box (legend icons).
export function getCirculationArrowPathForSpan({
  span,
  headHeight,
  arrowRight = true,
  arrowLeft = true,
}) {
  const unitSpan = getCirculationArrowSpan({
    length: 1,
    arrowRight,
    arrowLeft,
  });
  return getCirculationArrowPath({
    length: span / unitSpan,
    headHeight,
    arrowRight,
    arrowLeft,
  });
}

// Legend item props of a CIRCULATION annotation / template (null otherwise):
// the legend glyph is the band with an arrow inside.
export function getCirculationLegendProps(annotation, template) {
  const drawingShape = annotation?.drawingShape ?? template?.drawingShape;
  if (drawingShape !== "CIRCULATION") return null;
  const pick = (key, fallback) =>
    annotation?.[key] ?? template?.[key] ?? fallback;
  const arrowRight = pick("arrowRight", true);
  const arrowLeft = pick("arrowLeft", true);
  const none = !arrowRight && !arrowLeft;
  return {
    // No direction at all: the glyph still shows a (double) arrow.
    arrowRight: none ? true : arrowRight,
    arrowLeft: none ? true : arrowLeft,
    arrowOpacity: pick("arrowOpacity", CIRCULATION_ARROW_DEFAULT_OPACITY),
    strokeOpacity: pick("strokeOpacity", 1),
  };
}
