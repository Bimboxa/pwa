import spriteImage from "../assets/spriteImage3x3.png";

import { Box } from "@mui/material";

import getRowAndColFromIndex from "../utils/getRowAndColFromIndex";

export default function MarkerIcon({
  spriteImage,
  iconKey,
  fillColor,
  size = 24,
}) {
  // helpers - sprite image

  const {
    url: spriteImageUrl,
    iconKeys,
    columns,
    rows,
    tile,
  } = spriteImage ?? {};
  // helpers

  const index = iconKeys.indexOf(iconKey);

  //

  const scale = size / tile;
  const spriteW = columns * tile;
  const spriteH = rows * tile; // 3x3

  const row = Math.floor(index / columns);
  const col = index % columns;

  const offsetX = col * tile;
  const offsetY = row * tile;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: "50%",
        bgcolor: fillColor,
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
        }}
      >
        <Box>
          <Box
            sx={{
              width: tile,
              height: tile,
              backgroundImage: `url(${spriteImageUrl})`,
              backgroundPosition: `-${offsetX}px -${offsetY}px`,
              backgroundSize: `${spriteW}px ${spriteH}px`,
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
