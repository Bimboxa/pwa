import { useState, useEffect } from "react";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import getAnnotationQties from "../utils/getAnnotationQties";

export default function SectionAnnotationQties({ annotation }) {
  const { type } = annotation ?? {};

  const baseMap = useMainBaseMap();

  const qties = getAnnotationQties({ annotation, meterByPx: baseMap?.meterByPx });
  console.log("debug_1902_qties", annotation, baseMap, qties)

  const showSurface = ["RECTANGLE", "POLYGON", "STRIP"].includes(type)

  if (!qties) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Longueur : {qties.length?.toFixed?.(2) ?? 0} m
      </Typography>
      {showSurface && (
        <Typography variant="caption" color="text.secondary">
          Surface : {qties.surface?.toFixed?.(2) ?? 0} m²
        </Typography>
      )}
    </Box>
  );
}
