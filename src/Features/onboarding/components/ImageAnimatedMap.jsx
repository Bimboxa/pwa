import animatedMap from "../assets/animatedMap.gif";

import { Box } from "@mui/material";

export default function ImageAnimatedMap() {
  return (
    <Box
      sx={{ width: 1, height: 1, display: "flex", justifyContent: "center" }}
    >
      <img
        src={animatedMap}
        alt="animatedMap"
        sx={{ width: 1, height: 1, objectFit: "contain" }}
      />
    </Box>
  );
}
