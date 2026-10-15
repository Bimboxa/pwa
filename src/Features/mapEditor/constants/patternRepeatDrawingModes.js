// Click-drawn path modes that support « Répétition du motif » (`*N`, see
// utils/patternRepeat.js) — 2D InteractionLayer, 3D useDrawingPointerHandlers
// (POLYLINE / POLYGON only there: no STRIP in 3D) and the helper card
// SectionDrawingPatternRepeat. Cut / split / completion paths are excluded:
// their points must land on existing geometry.
const PATTERN_REPEAT_DRAWING_MODES = [
  "CLICK",
  "POLYLINE_CLICK",
  "POLYGON_CLICK",
  "STRIP",
];

export default PATTERN_REPEAT_DRAWING_MODES;
