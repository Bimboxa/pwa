import { useState, useRef, useEffect } from "react";

import { Box, IconButton } from "@mui/material";
import theme from "Styles/theme";

import MarkerIcon from "./MarkerIcon";
import DiskGeneric from "Features/form/components/DiskGeneric";

import getRowAndColFromIndex from "../utils/getRowAndColFromIndex";

export default function SelectorMarkerIcon({
  iconKey,
  onChange,
  iconColor,
  spriteImage,
}) {
  const size = 18;

  // helper

  //const bgcolor = theme.palette.primary.main;
  const bgcolorDefault = theme.palette.grey[400];

  return (
    <Box sx={{ width: 1, display: "flex", justifyContent: "center", p: 1 }}>
      <Box
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
                bgcolor,
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mx: 1,
                mb: 2,
              }}
            >
              <IconButton size="small" onClick={() => onChange(_iconKey)}>
                <MarkerIcon
                  iconKey={_iconKey}
                  spriteImage={spriteImage}
                  size={size}
                />
              </IconButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
