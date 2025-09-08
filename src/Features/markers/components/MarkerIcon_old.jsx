import spriteImage from "../assets/spriteImage3x3.png";

import { Box } from "@mui/material";

export default function MarkerIcon({ row, col, size, iconSize = 64 }) {
  const offsetX = (col - 1) * iconSize;
  const offsetY = (row - 1) * iconSize;
  const spriteSize = iconSize * 3;
  const scale = size / iconSize;

  return (
    <Box>
      <Box
        sx={{
          width: size,
          height: size,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          //overflow: "hidden",
        }}
      >
        <Box>
          <Box
            sx={{
              width: iconSize,
              height: iconSize,
              backgroundImage: `url(${spriteImage})`,
              backgroundPosition: `-${offsetX}px -${offsetY}px`,
              backgroundSize: `${spriteSize}px ${spriteSize}px`,
              backgroundRepeat: "no-repeat",
              transform: `scale(${scale})`,
              transformOrigin: "center",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
