import { useSmartZoom } from "App/contexts/SmartZoomContext";

import { Box, Paper } from "@mui/material";

const LOUPE_SIZE = 200;

export default function SmartDetectContainer() {

  const { setZoomContainer } = useSmartZoom();

  return <Box sx={{
    p: 0,
    mt: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <Box
      id="smart-zoom-target"
      ref={setZoomContainer}
      sx={{
        width: 1,
      }}
    />
  </Box>
}
