import { BOUNDARY_DETECT_MODE } from "./boundaryDetectMode";

// Drawing mode of the « Vectoriser au surligneur » tool (POLYLINE group):
// a drag highlights the pixels to follow (disc of fixed screen size), the
// release commits the polyline fitted through them.
export const HIGHLIGHT_VECTORIZE_MODE = "POLYLINE_HIGHLIGHT_VECTORIZE";

// Drawing modes driven by the highlighter gesture (clicks start / end the
// strokes, Enter commits): « Vectoriser au surligneur » and « Détection de
// frontière auto ».
const HIGHLIGHT_STROKE_MODES = [
  HIGHLIGHT_VECTORIZE_MODE,
  BOUNDARY_DETECT_MODE,
];

export function isHighlightStrokeMode(mode) {
  return HIGHLIGHT_STROKE_MODES.includes(mode);
}
