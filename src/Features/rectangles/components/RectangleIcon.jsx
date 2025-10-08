import { Box } from "@mui/material";

import { Rectangle } from "@mui/icons-material";

export default function RectangleIcon({ fillColor, closeLine, size = 24 }) {
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
          color: fillColor,
        }}
      >
        <Rectangle />
      </Box>
    </Box>
  );
}
