import { useRef, useEffect, useState } from "react";

import { Box, IconButton } from "@mui/material";
import theme from "Styles/theme";

import MarkerIcon from "./MarkerIcon";

export default function SelectorMarkerIcon({
  iconKey,
  onChange,
  iconColor,
  spriteImage,
  size = 40,
  rows = 4,
}) {
  // ref

  const ref = useRef();

  // helper - cardWidth

  const [cardWidth, setCardWidth] = useState(20);
  useEffect(() => {
    const width = ref.current?.getBoundingClientRect()?.width;
    setCardWidth(width / rows);
  }, [ref.current]);

  //const bgcolor = theme.palette.primary.main;
  const bgcolorDefault = theme.palette.grey[400];
  const iconColorDefault = theme.palette.grey[800];

  if (!iconColor) iconColor = iconColorDefault;

  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        ref={ref}
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {spriteImage?.iconKeys?.map((_iconKey) => {
          const bgcolor = _iconKey === iconKey ? iconColor : bgcolorDefault;

          return (
            <Box
              key={_iconKey}
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mx: 1,
                mb: 2,
                width: cardWidth,
                height: cardWidth,
              }}
            >
              <Box
                sx={{
                  bgcolor,
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <IconButton
                  sx={{ width: size, height: size }}
                  onClick={() => onChange(_iconKey)}
                >
                  <MarkerIcon
                    iconKey={_iconKey}
                    spriteImage={spriteImage}
                    size={size}
                  />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
