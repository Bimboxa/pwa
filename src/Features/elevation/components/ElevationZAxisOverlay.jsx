import { Box, Typography } from "@mui/material";

import { Z_AXIS_INSET_PX } from "Features/elevation/hooks/useElevationZAxis";

// Screen-fixed vertical Z axis glyph (arrow + line + "z"), pinned to the LEFT
// or RIGHT edge (`side`). Rendered OUTSIDE the camera group so it never pans /
// zooms away; its line center sits Z_AXIS_INSET_PX from that edge, matching the
// zAxisWorldX the Z = 0 line + Offset field anchor to.
export default function ElevationZAxisOverlay({ side = "right" }) {
  return (
    <Box
      sx={{
        position: "absolute",
        top: 12,
        bottom: 52,
        [side]: Z_AXIS_INSET_PX,
        width: 0,
        pointerEvents: "none",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          position: "absolute",
          top: -4,
          [side === "right" ? "left" : "right"]: 6,
          color: "grey.600",
        }}
      >
        z
      </Typography>
      {/* arrow head */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderBottom: "8px solid",
          borderBottomColor: "grey.500",
        }}
      />
      {/* vertical line */}
      <Box
        sx={{
          position: "absolute",
          top: 7,
          bottom: 0,
          left: 0,
          transform: "translateX(-50%)",
          width: "2px",
          bgcolor: "grey.500",
        }}
      />
    </Box>
  );
}
