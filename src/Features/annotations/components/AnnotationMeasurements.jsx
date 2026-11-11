import { Box, Tooltip, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getAnnotationQties, {
  hasPerVertexZOffsets,
} from "../utils/getAnnotationQties";
import getAnnotationPartQties from "../utils/getAnnotationPartQties";
import useSubtractedSurfaceM2 from "../hooks/useSubtractedSurfaceM2";

// angles: corner count (POLYLINE / STRIP), opt-in — only shown when passed.
export default function AnnotationMeasurements({
  annotation,
  surface,
  length,
  units,
  layoutLength,
  part,
  angles,
}) {
  // data

  const baseMap = useMainBaseMap();

  // Developed surface removed by a 3D subtraction (POLYLINE sheet host).
  const subtractedSurfaceM2 = useSubtractedSurfaceM2(annotation);

  // helpers - use pre-computed values if provided, otherwise compute from annotation

  let computedSurface = surface;
  let computedLength = length;
  // Unit count — only set for types whose qties carry one (LINEAR_LAYOUT:
  // number of bars).
  let computedUnits = units;
  // Layout lines total (lignes de calepinage, POLYGON only).
  let computedLayoutLength = layoutLength;
  let enabled = true;
  const hasPart = part && part.kind && part.kind !== "NONE";

  if (annotation && surface == null && length == null) {
    const qties = hasPart
      ? getAnnotationPartQties({
          annotation,
          part,
          meterByPx: baseMap?.meterByPx,
        })
      : getAnnotationQties({
          annotation,
          meterByPx: baseMap?.meterByPx,
          imageSize: baseMap?.getImageSize?.(),
        });
    if (!qties?.enabled) enabled = false;
    // Prefer the developed (sloped) values when a guideLine ramp is present.
    computedSurface =
      qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
    computedLength =
      qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
    if (!hasPart && Number.isFinite(qties?.count)) computedUnits = qties.count;
    if (!hasPart && Number.isFinite(qties?.layoutLength))
      computedLayoutLength = qties.layoutLength;

    // Subtract the developed surface removed by a 3D boolean subtraction.
    if (!hasPart && subtractedSurfaceM2 > 0 && computedSurface != null) {
      computedSurface = Math.max(0, computedSurface - subtractedSurfaceM2);
    }
  }

  // When a part is selected we want surface to show whenever the calc returns
  // one (e.g. CUT → area), not gated on the host annotation type.
  const showSurface = hasPart
    ? computedSurface != null && computedSurface > 0
    : computedSurface != null &&
      computedSurface > 0 &&
      (surface != null ||
        // Mesh 3D: the surface of its faces, whatever the row type.
        annotation?.isMesh3d ||
        ["RECTANGLE", "POLYGON", "STRIP"].includes(annotation?.type) ||
        (annotation?.type === "POLYLINE" &&
          (annotation?.height ||
            annotation?.shape3D?.key === "REVOLUTION" ||
            // Slope walls (parois): per-vertex offsets define a vertical band,
            // so the wall has a real lateral surface to display.
            hasPerVertexZOffsets(annotation))));

  const showLength = computedLength != null && computedLength > 0;
  const showUnits = computedUnits != null && computedUnits > 0;
  const showLayoutLength =
    computedLayoutLength != null && computedLayoutLength > 0;
  const showAngles = Number.isFinite(angles);

  if (
    !enabled ||
    (!showSurface &&
      !showLength &&
      !showUnits &&
      !showLayoutLength &&
      !showAngles)
  )
    return null;

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      {showUnits && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            color: "warning.main",
            fontWeight: 500,
          }}
        >
          {computedUnits} u
        </Typography>
      )}
      {showSurface && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            color: "warning.main",
            fontWeight: 500,
          }}
        >
          {computedSurface.toFixed(2)} m²
        </Typography>
      )}
      {showLength && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            color: "warning.main",
            fontWeight: 500,
          }}
        >
          {computedLength.toFixed(2)} ml
        </Typography>
      )}
      {showAngles && (
        <Tooltip title="Nombre d'angles">
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: "warning.main",
              fontWeight: 500,
            }}
          >
            {angles} {angles > 1 ? "angles" : "angle"}
          </Typography>
        </Tooltip>
      )}
      {showLayoutLength && (
        <Tooltip title="Longueur de calepinage">
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: "warning.main",
              fontWeight: 500,
            }}
          >
            {computedLayoutLength.toFixed(2)} ml calep.
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
}
