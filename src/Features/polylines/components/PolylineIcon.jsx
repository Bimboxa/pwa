import { Box } from "@mui/material";

import { Polyline } from "@mui/icons-material";

export default function PolylineIcon({ fillColor, strokeColor, size = 24 }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: "50%",
        bgcolor: fillColor ?? "white",
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
          color: strokeColor,
        }}
      >
        <Polyline />
      </Box>
    </Box>
  );
}
