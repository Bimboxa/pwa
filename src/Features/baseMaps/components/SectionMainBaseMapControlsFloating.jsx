import { useSelector } from "react-redux";

import { Box, Paper } from "@mui/material";

import SectionMainBaseMapControls from "./SectionMainBaseMapControls";
import useShowMainBaseMapControls from "../hooks/useShowMainBaseMapControls";

// Full screen host of the main base map controls (SectionMainBaseMapControls):
// the top bar is gone, the controls float at the top center of the displayed
// editor, in a card with the look of the top-right row (ButtonBaseMapsGrid).
// Mounted by the 2D editor (UILayerDesktop) and the 3D editor
// (MainThreedEditor); `zIndex` matches the row of the host. Renders nothing
// outside full screen (the top bar then shows the section).
export default function SectionMainBaseMapControlsFloating({ zIndex = 1 }) {
  // data

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const show = useShowMainBaseMapControls();

  // render

  if (!isFullScreen || !show) return null;

  return (
    <Box
      data-capture-hide
      sx={{
        position: "absolute",
        left: "50%",
        top: "7px",
        transform: "translateX(-50%)",
        zIndex,
        maxWidth: "calc(100% - 32px)",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          borderRadius: "10px",
          px: 0.5,
          py: 0.25,
          display: "flex",
          alignItems: "center",
        }}
      >
        <SectionMainBaseMapControls />
      </Paper>
    </Box>
  );
}
