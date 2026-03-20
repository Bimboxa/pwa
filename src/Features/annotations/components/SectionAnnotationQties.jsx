import { useState, useEffect } from "react";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import getAnnotationQties from "../utils/getAnnotationQties";

export default function SectionAnnotationQties({ annotation }) {
  const { type } = annotation ?? {};

  const baseMap = useMainBaseMap();

  const qties = getAnnotationQties({ annotation, meterByPx: baseMap?.meterByPx });

  const showSurface = ["RECTANGLE", "POLYGON", "STRIP"].includes(type)
    || (type === "POLYLINE" && annotation?.height)

  const lengthLabel = type === "POINT" ? "Hauteur" : "Longueur";
  const showLength = qties?.length > 0;

  if (!qties) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 1 }}>
      {showLength && (
        <Typography variant="caption" color="text.secondary">
          {lengthLabel} : {qties.length?.toFixed?.(2) ?? 0} m
        </Typography>
      )}
      {showSurface && (
        <Typography variant="caption" color="text.secondary">
          Surface : {qties.surface?.toFixed?.(2) ?? 0} m²
        </Typography>
      )}
    </Box>
  );
}
