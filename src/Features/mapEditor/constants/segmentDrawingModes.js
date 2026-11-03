// Drawing modes that produce segments and support the live length display /
// typed length constraint (SectionSegmentLengthConstraint, DrawingLengthBadge).
// The 3D "Coupe face" segment / polyline (K / L) draw their cutting path the
// same way (useDrawingPointerHandlers / DrawingOverlayThreed).
const SEGMENT_DRAWING_MODES = [
  "CLICK",
  "POLYLINE_CLICK",
  "POLYLINE_SEGMENT",
  "STRIP_SEGMENT",
  "POLYGON_CLICK",
  "CUT_CLICK",
  "SPLIT_CLICK",
  "STRIP",
  "MEASURE",
  "COTE_TWO_CLICK",
  "COMPLETE_ANNOTATION",
  "FACE_CUT_SEGMENT",
  "FACE_CUT_POLYLINE",
];

export default SEGMENT_DRAWING_MODES;
