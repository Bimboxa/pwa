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

  // When a slope is present (guideLine ramp), surface up the developed (sloped)
  // surface / perimeter as the displayed quantity instead of the flat footprint.
  const surface = qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
  const length = qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
  const showLength = length > 0;

  if (!qties) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 1 }}>
      {showLength && (
        <Typography variant="caption" color="text.secondary">
          {lengthLabel} : {length?.toFixed?.(2) ?? 0} m
        </Typography>
      )}
      {showSurface && (
        <Typography variant="caption" color="text.secondary">
          Surface : {surface?.toFixed?.(2) ?? 0} m²
        </Typography>
      )}
    </Box>
  );
}
