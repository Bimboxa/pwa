import { useSmartZoom } from "App/contexts/SmartZoomContext";

import { Box, Paper } from "@mui/material";

const LOUPE_SIZE = 150;

export default function SmartDetectContainer() {

  const { setZoomContainer } = useSmartZoom();


  return <Box sx={{
    p: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative",
  }}>
    <Paper
      elevation={0}
      id="smart-zoom-target"
      ref={setZoomContainer} // On passe la ref au Context
      sx={{
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        bgcolor: '#000',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  </Box>
}
