import { useState, useEffect } from "react";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import getAnnotationQties from "../utils/getAnnotationQties";

export default function SectionAnnotationQties({ annotation }) {
  const { closeLine, type } = annotation ?? {};

  const baseMap = useMainBaseMap();

  console.log("debug_711_annotation", annotation?.points);

  const qties = getAnnotationQties(annotation, baseMap);

  if (!qties) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Longueur : {qties.length?.toFixed?.(2) ?? 0} m
      </Typography>
      {closeLine && (
        <Typography variant="caption" color="text.secondary">
          Surface : {qties.surface?.toFixed?.(2) ?? 0} m²
        </Typography>
      )}
    </Box>
  );
}
