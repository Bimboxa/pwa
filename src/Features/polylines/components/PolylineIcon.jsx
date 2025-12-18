import { Box } from "@mui/material";

import { Polyline, PentagonOutlined as Polygon } from "@mui/icons-material";

export default function PolylineIcon({
  fillColor,
  strokeColor,
  closeLine,
  size = 24,
}) {
  const color = closeLine ? fillColor : strokeColor;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: "50%",
        bgcolor: "white",
      }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          //overflow: "hidden",
          //color: strokeColor,
          color,
        }}
      >

        <Polyline sx={{ fontSize: size * 0.7 }} />

      </Box>
    </Box>
  );
}
