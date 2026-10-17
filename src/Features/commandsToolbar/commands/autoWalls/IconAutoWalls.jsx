import { Box } from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

import IconSlopeWall from "Features/annotations/components/IconSlopeWall";

// Wall icon with a star badge marking the auto behavior.
export default function IconAutoWalls() {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <IconSlopeWall />
      <AutoAwesome
        sx={{
          fontSize: "9px !important",
          position: "absolute",
          top: -3,
          right: -4,
        }}
      />
    </Box>
  );
}
