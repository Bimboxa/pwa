import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import ButtonAppVersion from "App/components/ButtonAppVersion";
import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import ButtonDocumentation from "Features/documentation/components/ButtonDocumentation";
import HelperClickInBgPosition from "Features/mapEditor/components/HelperClickInBgPosition";
import useHelperMessageInBottomBar from "Features/mapEditor/hooks/useHelperMessageInBottomBar";
import ButtonSigninV2 from "Features/auth/components/ButtonSigninV2";
import SwitchCoupledNavigation from "Features/layout/components/SwitchCoupledNavigation";
import RectangleDimsBottomBar from "Features/annotations/components/RectangleDimsBottomBar";
import SegmentLengthBottomBar from "Features/annotations/components/SegmentLengthBottomBar";
import CircleRadiusBottomBar from "Features/annotations/components/CircleRadiusBottomBar";
import FaceCutAxisBottomBar from "Features/threedFaceCut/components/FaceCutAxisBottomBar";
import RevolutionAxisRadiusBottomBarThreed from "Features/revolutionAxes/components/RevolutionAxisRadiusBottomBarThreed";
import { selectIsRevolutionAxisDrawThreedActive } from "Features/revolutionAxes/utils/revolutionAxisDrawThreedSelectors";
import ToolbarDrawingDraft from "Features/mapEditor/components/ToolbarDrawingDraft";
import ToolbarStartDrawTemplate from "Features/panelDrawing/components/ToolbarStartDrawTemplate";
import SectionReadOnlyScopeInBottomBar from "Features/scopes/components/SectionReadOnlyScopeInBottomBar";

// Drawing modes that surface a dedicated bottom-bar UI (and hide the regular
// bottom-bar items so they don't compete for space).
const RECTANGLE_DRAWING_MODES = [
  "RECTANGLE",
  "POLYLINE_RECTANGLE",
  "POLYGON_RECTANGLE",
  "CUT_RECTANGLE",
  "FACE_CUT_RECTANGLE",
];

// "Coupe face" axis cuts (3D editor) — cut distance display + typed
// constraint (FaceCutAxisBottomBar).
const FACE_CUT_AXIS_DRAWING_MODES = [
  "FACE_CUT_HORIZONTAL",
  "FACE_CUT_VERTICAL",
];

// Center/radius circle modes — surface a dedicated radius display + lock.
const CIRCLE_RADIUS_DRAWING_MODES = [
  "POLYLINE_CIRCLE_RADIUS",
  "POLYGON_CIRCLE_RADIUS",
  "REVOLUTION_AXIS_PLAN",
];

// Modes that produce segments and support length display / constraint.
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
];

export default function BottomBarDesktop() {
  // data

  const height = useSelector((s) => s.layout.bottomBarHeightDesktop);
  const helperMessage = useHelperMessageInBottomBar();
  const enabledDrawingMode = useSelector(
    (s) => s.mapEditor.enabledDrawingMode
  );
  // Revolution axis drawn from the 3D editor: the live radius comes from the
  // 3D overlay, not from the 2D preview CircleRadiusBottomBar polls.
  const isRevolutionAxisDraw3d = useSelector(
    selectIsRevolutionAxisDrawThreedActive
  );

  // helpers

  const showRectangleDims =
    RECTANGLE_DRAWING_MODES.includes(enabledDrawingMode);
  const showSegmentLength =
    SEGMENT_DRAWING_MODES.includes(enabledDrawingMode);
  const showCircleRadius =
    CIRCLE_RADIUS_DRAWING_MODES.includes(enabledDrawingMode);
  const showFaceCutAxis =
    FACE_CUT_AXIS_DRAWING_MODES.includes(enabledDrawingMode);
  const showDrawingBar =
    showRectangleDims ||
    showSegmentLength ||
    showCircleRadius ||
    showFaceCutAxis;
  // The 3D "Coupe face" rectangle is drawn in metres, whatever the scale of
  // the main base map.
  const rectangleUnit =
    enabledDrawingMode === "FACE_CUT_RECTANGLE" ? "m" : null;

  // render

  if (showDrawingBar) {
    return (
      <Box
        sx={{
          bgcolor: "white",
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          height,
          minHeight: height,
          display: "flex",
          alignItems: "center",
          zIndex: 400,
          px: 0.5,
          position: "relative",
        }}
      >
        <ToolbarDrawingDraft />
        {showRectangleDims && <RectangleDimsBottomBar unit={rectangleUnit} />}
        {showFaceCutAxis && <FaceCutAxisBottomBar />}
        {showSegmentLength && <SegmentLengthBottomBar />}
        {showCircleRadius &&
          (isRevolutionAxisDraw3d ? (
            <RevolutionAxisRadiusBottomBarThreed />
          ) : (
            <CircleRadiusBottomBar />
          ))}
        <SectionReadOnlyScopeInBottomBar />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        height,
        minHeight: height,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 400,
        pr: 0.5,
        position: "relative",
      }}
    >
      <ToolbarDrawingDraft />
      {/* Dessin panel on a template's annotations list: pick a tool to start
          drawing an annotation of that template (null once a draw is armed). */}
      <ToolbarStartDrawTemplate />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", pl: 1 }}>
        <ButtonSigninV2 />
        <ButtonAppVersion />
        <ButtonDialogAppConfig />
        <ButtonDocumentation />
      </Box>

      <SectionReadOnlyScopeInBottomBar />

      {helperMessage && (
        <Box sx={{ bgcolor: "warning.main", borderRadius: "0px", px: 1 }}>
          <Typography color="white" variant="caption">
            {helperMessage}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center" }}>
        <HelperClickInBgPosition />
        <SwitchCoupledNavigation />
      </Box>
    </Box>
  );
}
