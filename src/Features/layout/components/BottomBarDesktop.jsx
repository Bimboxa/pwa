import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import ButtonAppVersion from "App/components/ButtonAppVersion";
import ButtonDialogAppConfig from "Features/appConfig/components/ButtonDialogAppConfig";
import ButtonDocumentation from "Features/documentation/components/ButtonDocumentation";
import HelperClickInBgPosition from "Features/mapEditor/components/HelperClickInBgPosition";
import useHelperMessageInBottomBar from "Features/mapEditor/hooks/useHelperMessageInBottomBar";
import ButtonSigninV2 from "Features/auth/components/ButtonSigninV2";
import SwitchCoupledNavigation from "Features/layout/components/SwitchCoupledNavigation";
import ToolbarDrawingDraft from "Features/mapEditor/components/ToolbarDrawingDraft";
import ToolbarStartDrawTemplate from "Features/panelDrawing/components/ToolbarStartDrawTemplate";
import SectionReadOnlyScopeInBottomBar from "Features/scopes/components/SectionReadOnlyScopeInBottomBar";
import SectionBaseMapsBottomBarControls from "Features/baseMaps/components/SectionBaseMapsBottomBarControls";

// The typed length / dimension constraints of the drawing modes (rectangle
// sides, segment length, radius, cut distance) live in the drawing helper's
// « Contraintes » card (SectionDrawingConstraints), not here.

export default function BottomBarDesktop() {
  // data

  const height = useSelector((s) => s.layout.bottomBarHeightDesktop);
  const helperMessage = useHelperMessageInBottomBar();

  // render

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

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <HelperClickInBgPosition />
        {/* Base map image mode + base maps grid of the displayed editor */}
        <SectionBaseMapsBottomBarControls />
        <SwitchCoupledNavigation />
      </Box>
    </Box>
  );
}
