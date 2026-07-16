import { Box, Divider, Typography } from "@mui/material";

import SectionCaptureFormat from "Features/mapEditor/components/SectionCaptureFormat";
import SectionCaptureLegend from "Features/mapEditor/components/SectionCaptureLegend";

// Default properties panel of the POV viewer (no POV selected): the capture
// frame settings — aspect ratio + legend — driving the shared imageMode state
// that ImageModeOverlay reads in both 2D and 3D.
export default function PanelPovFrameProperties() {
  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: "bold", pl: 1 }}>
        Cadre
      </Typography>
      <Divider />
      <SectionCaptureFormat />
      <SectionCaptureLegend />
    </Box>
  );
}
