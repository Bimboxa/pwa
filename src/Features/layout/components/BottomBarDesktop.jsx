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
import ToolbarDrawingDraft from "Features/mapEditor/components/ToolbarDrawingDraft";

// Drawing modes that surface a dedicated bottom-bar UI (and hide the regular
// bottom-bar items so they don't compete for space).
const RECTANGLE_DRAWING_MODES = [
  "RECTANGLE",
  "POLYLINE_RECTANGLE",
  "POLYGON_RECTANGLE",
  "CUT_RECTANGLE",
];

// Center/radius circle modes — surface a dedicated radius display + lock.
const CIRCLE_RADIUS_DRAWING_MODES = [
  "POLYLINE_CIRCLE_RADIUS",
  "POLYGON_CIRCLE_RADIUS",
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

  // helpers

  const showRectangleDims =
    RECTANGLE_DRAWING_MODES.includes(enabledDrawingMode);
  const showSegmentLength =
    SEGMENT_DRAWING_MODES.includes(enabledDrawingMode);
  const showCircleRadius =
    CIRCLE_RADIUS_DRAWING_MODES.includes(enabledDrawingMode);
  const showDrawingBar =
    showRectangleDims || showSegmentLength || showCircleRadius;

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
        {showRectangleDims && <RectangleDimsBottomBar />}
        {showSegmentLength && <SegmentLengthBottomBar />}
        {showCircleRadius && <CircleRadiusBottomBar />}
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
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", pl: 1 }}>
        <ButtonSigninV2 />
        <ButtonAppVersion />
        <ButtonDialogAppConfig />
        <ButtonDocumentation />
      </Box>

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
