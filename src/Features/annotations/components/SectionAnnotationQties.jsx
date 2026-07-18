import { useState, useEffect } from "react";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import getAnnotationQties from "../utils/getAnnotationQties";
import getAnnotationSubtractionQties from "../utils/getAnnotationSubtractionQties";
import getAnnotationOpeningQties from "../utils/getAnnotationOpeningQties";

export default function SectionAnnotationQties({ annotation }) {
  const { type } = annotation ?? {};

  const baseMap = useMainBaseMap();

  const qties = getAnnotationQties({ annotation, meterByPx: baseMap?.meterByPx });

  // When the annotation subtracts other annotations, the displayed surface is
  // the carved (boolean-difference) footprint. Only meaningful for slab-type
  // sources (footprint = surface); POLYLINE surfaces are left untouched here.
  if (
    qties &&
    annotation?.subtractionTargets?.length > 0 &&
    ["POLYGON", "RECTANGLE", "STRIP"].includes(type)
  ) {
    const subQ = getAnnotationSubtractionQties({
      annotation,
      targets: annotation.subtractionTargets,
      meterByPx: baseMap?.meterByPx,
    });
    if (subQ) {
      qties.surface = subQ.surface;
      qties.surfaceDeveloped = subQ.surfaceDeveloped;
    }
  }

  // Glued openings (relAnnotationOpenings, resolved by useAnnotationsV2 as
  // `annotation.openings`) deduct width × overlapHeight from the surface —
  // even when their template is hidden.
  if (qties && annotation?.openings?.length > 0) {
    const openQ = getAnnotationOpeningQties({
      host: annotation,
      openings: annotation.openings,
    });
    if (openQ?.deductedM2 > 0) {
      if (Number.isFinite(qties.surface)) {
        qties.surface = Math.max(0, qties.surface - openQ.deductedM2);
      }
      if (Number.isFinite(qties.surfaceDeveloped)) {
        qties.surfaceDeveloped = Math.max(
          0,
          qties.surfaceDeveloped - openQ.deductedM2
        );
      }
    }
  }

  const showSurface = ["RECTANGLE", "POLYGON", "STRIP"].includes(type)
    || (type === "POLYLINE" && annotation?.height)

  const lengthLabel = type === "POINT" ? "Hauteur" : "Longueur";

  // When a slope is present (guideLine ramp), surface up the developed (sloped)
  // surface / perimeter as the displayed quantity instead of the flat footprint.
  const surface = qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
  const length = qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
  const showLength = length > 0;

  // Projected (planar footprint) surface. Only worth showing alongside the
  // developed surface when a slope makes the two differ — otherwise it would
  // just repeat the "Surface" line.
  const projectedSurface = qties?.surface;
  const showProjectedSurface =
    showSurface && qties?.surfaceDeveloped != null && projectedSurface != null;

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
      {showProjectedSurface && (
        <Typography variant="caption" color="text.secondary">
          Surface projetée : {projectedSurface?.toFixed?.(2) ?? 0} m²
        </Typography>
      )}
    </Box>
  );
}
