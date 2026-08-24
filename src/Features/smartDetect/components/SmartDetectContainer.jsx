import { useSmartZoom } from "App/contexts/SmartZoomContext";

import { Box } from "@mui/material";

// Matches LOUPE_SIZE used in InteractionLayer — the "SQUARE" aspect ratio
// renders at exactly this size, and Portrait / Landscape loupes are
// centered within a square of this size so the card layout never jumps.
const LOUPE_SIZE = 200;

export default function SmartDetectContainer() {
  // Null-safe: outside a SmartZoomProvider (e.g. a stray mount out of the 2D
  // editor tree) the loupe box renders empty instead of crashing.
  const { setZoomContainer } = useSmartZoom() ?? {};

  return (
    <Box
      sx={{
        p: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        bgcolor: "background.default",
        borderRadius: 1,
        mx: "auto",
      }}
    >
      <Box
        id="smart-zoom-target"
        ref={setZoomContainer}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    </Box>
  );
}
