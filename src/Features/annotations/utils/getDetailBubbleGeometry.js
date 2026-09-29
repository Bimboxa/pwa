// Geometry of a DETAIL bubble, derived from its text and its font size.
//
// Every length is in the unit of `fontSize` (page points in NodeDetailStatic)
// and proportional to it, so the whole bubble scales with the text size.
// The bubble stays a circle: its radius is the half diagonal of the text box
// plus a padding, with a floor so that 1-2 character refs keep a steady size.
//
// measureTextWidth(text, fontSize) is injected (canvas in the app, see
// measureTextWidth.js) to keep this util pure.

export const DETAIL_LINE_HEIGHT = 1.2;
export const DETAIL_EMPTY_TEXT = "X";

const MIN_RADIUS_RATIO = 0.95;
const PADDING_RATIO = 0.25;
const RING_WIDTH_RATIO = 0.2;
const ARROW_LEN_RATIO = 0.85; // gap between the tip and the bubble edge
const ARROW_HALF_W_RATIO = 0.5;
const ARROW_BASE_OVERLAP_RATIO = 0.3; // arrow base hidden under the bubble fill
const HIT_MARGIN_RATIO = 0.25;
const ROT_RING_MARGIN_RATIO = 0.6;

// Fallback when no measure is available: average bold glyph ≈ 0.6 em.
function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

export default function getDetailBubbleGeometry({
  text,
  fontSize,
  measureTextWidth,
}) {
  const lines = String(text || DETAIL_EMPTY_TEXT).split("\n");

  const measure = (line) => {
    const width = measureTextWidth?.(line, fontSize);
    return Number.isFinite(width) && width >= 0
      ? width
      : estimateTextWidth(line, fontSize);
  };

  const textWidth = Math.max(...lines.map(measure));
  const textHeight = lines.length * fontSize * DETAIL_LINE_HEIGHT;

  const radius = Math.max(
    fontSize * MIN_RADIUS_RATIO,
    Math.hypot(textWidth / 2, textHeight / 2) + fontSize * PADDING_RATIO
  );
  const arrowLen = fontSize * ARROW_LEN_RATIO;
  const tipOffset = radius + arrowLen; // tip → bubble center

  return {
    textWidth,
    textHeight,
    radius,
    ringWidth: fontSize * RING_WIDTH_RATIO,
    arrowLen,
    arrowHalfW: fontSize * ARROW_HALF_W_RATIO,
    arrowBaseOverlap: fontSize * ARROW_BASE_OVERLAP_RATIO,
    tipOffset,
    hitRadius: radius + fontSize * HIT_MARGIN_RATIO,
    rotRingR: tipOffset + radius + fontSize * ROT_RING_MARGIN_RATIO, // rotation helper orbit
  };
}
