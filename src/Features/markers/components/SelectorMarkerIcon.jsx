import { useState, useRef, useEffect } from "react";

import { Box, IconButton } from "@mui/material";
import theme from "Styles/theme";

import MarkerIcon from "./MarkerIcon";
import DiskGeneric from "Features/form/components/DiskGeneric";

import getRowAndColFromIndex from "../utils/getRowAndColFromIndex";

export default function SelectorMarkerIcon({ iconIndex, onChange, iconColor }) {
  const size = 24;

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
        {Array.from({ length: 9 }).map((_, idx) => {
          const { row, col } = getRowAndColFromIndex(idx);
          const bgcolor = idx === iconIndex ? iconColor : bgcolorDefault;

          return (
            <Box
              sx={{
                bgcolor,
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mx: 0.5,
                mb: 1,
              }}
            >
              <IconButton size="small" onClick={() => onChange(idx)}>
                <MarkerIcon row={row} col={col} size={size} />
              </IconButton>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
