import { useSelector } from "react-redux";

import { Box, Paper, Typography } from "@mui/material";

import SEGMENT_DRAWING_MODES from "Features/mapEditor/constants/segmentDrawingModes";
import { selectIsRevolutionAxisDrawThreedActive } from "Features/revolutionAxes/utils/revolutionAxisDrawThreedSelectors";

import SectionRectangleDimsConstraint from "Features/annotations/components/SectionRectangleDimsConstraint";
import SectionSegmentLengthConstraint from "Features/annotations/components/SectionSegmentLengthConstraint";
import SectionCircleRadiusConstraint from "Features/annotations/components/SectionCircleRadiusConstraint";
import SectionFaceCutAxisConstraint from "Features/threedFaceCut/components/SectionFaceCutAxisConstraint";
import SectionRevolutionAxisRadiusConstraintThreed from "Features/revolutionAxes/components/SectionRevolutionAxisRadiusConstraintThreed";

// ---------------------------------------------------------------------------
// SectionDrawingConstraints — « Contraintes » card of the drawing helper
// (SectionDrawingHelperContent): the typed length / dimension constraints of
// the armed drawing mode — the rectangle sides (X / Y), the segment being
// drawn, the circle radius, the "Coupe face" axis cut distance, the 3D
// revolution axis radius. Each body reads the keyboard buffers the editors
// feed (mapEditor.rectXBuffer / rectYBuffer / constraintBuffer, …): nothing
// is typed here. Null when the armed mode has no constraint UI.
// ---------------------------------------------------------------------------

// Rectangle tools (behavior "RECTANGLE" in drawingTools): sides typed via
// X / Y (mapEditor.rectXBuffer / rectYBuffer).
const RECTANGLE_DRAWING_MODES = [
  "RECTANGLE",
  "POLYLINE_RECTANGLE",
  "POLYGON_RECTANGLE",
  "CUT_RECTANGLE",
  "FACE_CUT_RECTANGLE",
];

// "Coupe face" axis cuts (3D editor) — cut distance display + typed
// constraint.
const FACE_CUT_AXIS_DRAWING_MODES = [
  "FACE_CUT_HORIZONTAL",
  "FACE_CUT_VERTICAL",
];

// Center/radius circle modes — radius display + lock.
const CIRCLE_RADIUS_DRAWING_MODES = [
  "POLYLINE_CIRCLE_RADIUS",
  "POLYGON_CIRCLE_RADIUS",
  "REVOLUTION_AXIS_PLAN",
];

export default function SectionDrawingConstraints() {
  // strings

  const titleS = "Contraintes";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  // Revolution axis drawn from the 3D editor: the live radius comes from the
  // 3D overlay, not from the 2D preview SectionCircleRadiusConstraint polls.
  const isRevolutionAxisDraw3d = useSelector(
    selectIsRevolutionAxisDrawThreedActive
  );

  // helpers

  const showRectangleDims =
    RECTANGLE_DRAWING_MODES.includes(enabledDrawingMode);
  const showFaceCutAxis =
    FACE_CUT_AXIS_DRAWING_MODES.includes(enabledDrawingMode);
  const showSegmentLength = SEGMENT_DRAWING_MODES.includes(enabledDrawingMode);
  const showCircleRadius =
    CIRCLE_RADIUS_DRAWING_MODES.includes(enabledDrawingMode);
  // The 3D "Coupe face" rectangle is drawn in metres, whatever the scale of
  // the main base map.
  const rectangleUnit =
    enabledDrawingMode === "FACE_CUT_RECTANGLE" ? "m" : null;

  const body = showRectangleDims ? (
    <SectionRectangleDimsConstraint unit={rectangleUnit} />
  ) : showFaceCutAxis ? (
    <SectionFaceCutAxisConstraint />
  ) : showSegmentLength ? (
    <SectionSegmentLengthConstraint />
  ) : showCircleRadius ? (
    isRevolutionAxisDraw3d ? (
      <SectionRevolutionAxisRadiusConstraintThreed />
    ) : (
      <SectionCircleRadiusConstraint />
    )
  ) : null;

  // render

  if (!body) return null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1, borderRadius: 1, bgcolor: "background.paper" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            color: "text.secondary",
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          {titleS}
        </Typography>
      </Box>
      {body}
    </Paper>
  );
}
