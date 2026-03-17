import { Box, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getAnnotationQties from "../utils/getAnnotationQties";

export default function AnnotationMeasurements({ annotation, surface, length }) {
  // data

  const baseMap = useMainBaseMap();

  // helpers - use pre-computed values if provided, otherwise compute from annotation

  let computedSurface = surface;
  let computedLength = length;
  let enabled = true;

  if (annotation && surface == null && length == null) {
    const qties = getAnnotationQties({
      annotation,
      meterByPx: baseMap?.meterByPx,
    });
    if (!qties?.enabled) enabled = false;
    computedSurface = qties?.surface;
    computedLength = qties?.length;
  }

  const showSurface =
    computedSurface != null &&
    computedSurface > 0 &&
    (surface != null ||
      ["RECTANGLE", "POLYGON", "STRIP"].includes(annotation?.type) ||
      (annotation?.type === "POLYLINE" && annotation?.height));

  const showLength = computedLength != null && computedLength > 0;

  if (!enabled || (!showSurface && !showLength)) return null;

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      {showSurface && (
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace", color: "warning.main", fontWeight: 500 }}
        >
          {computedSurface.toFixed(2)} m²
        </Typography>
      )}
      {showLength && (
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace", color: "warning.main", fontWeight: 500 }}
        >
          {computedLength.toFixed(2)} ml
        </Typography>
      )}
    </Box>
  );
}
