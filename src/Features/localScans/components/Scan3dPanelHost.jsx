import { Box } from "@mui/material";
import { registerScanPanelHost } from "../services/scanPanelHost";

// Drawer of the Scan 3D tool. The scan controller (LocalScansPanel, mounted
// with the 3D editor, in 2D too) portals its controls here.
export default function Scan3dPanelHost() {
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
    >
      <Box
        ref={registerScanPanelHost}
        sx={{
          minHeight: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      />
    </Box>
  );
}
