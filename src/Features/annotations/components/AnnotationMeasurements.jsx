import { Box, Tooltip, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import getAnnotationQties, {
  hasPerVertexZOffsets,
  QTIES_REASON_MESH_3D,
} from "../utils/getAnnotationQties";
import {
  MESH_3D_QTY_LABEL,
  MESH_3D_QTIES_TOOLTIP,
} from "../utils/getAnnotationTemplateMainQtyLabel";
import getAnnotationPartQties from "../utils/getAnnotationPartQties";
import useProfileResolution from "../hooks/useProfileResolution";
import useSubtractedSurfaceM2 from "../hooks/useSubtractedSurfaceM2";

// mesh3d: a group total (multi-selection) that holds a mesh 3D annotation —
// no surface / length total, the "⚠ 3D" marker is shown instead.
export default function AnnotationMeasurements({
  annotation,
  surface,
  length,
  units,
  part,
  mesh3d,
}) {
  // data

  const baseMap = useMainBaseMap();

  // For EXTRUSION_PROFILE: pre-resolve the profile so getAnnotationQties has
  // a profileLengthMeters to multiply by the guide length. The hook returns
  // null when not applicable / loading, which triggers the default formula.
  const profileTemplateId =
    annotation?.shape3D?.key === "EXTRUSION_PROFILE"
      ? annotation.shape3D.profileTemplateId ?? null
      : null;
  const profileResolution = useProfileResolution(profileTemplateId);
  const profileLengthMeters = profileResolution?.profileLengthMeters ?? null;

  // Developed surface removed by a 3D subtraction (EXTRUSION_PROFILE host).
  const subtractedSurfaceM2 = useSubtractedSurfaceM2(annotation);

  // helpers - use pre-computed values if provided, otherwise compute from annotation

  let computedSurface = surface;
  let computedLength = length;
  // Unit count — only set for types whose qties carry one (LINEAR_LAYOUT:
  // number of bars).
  let computedUnits = units;
  let enabled = true;
  // Mesh 3D annotation (or group holding one): "⚠ 3D" instead of the
  // surface / length. A selected face / edge (hasPart) keeps its own measure.
  let isMesh3d = Boolean(mesh3d);
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
          profileLengthMeters,
        });
    if (!qties?.enabled) enabled = false;
    if (!hasPart && qties?.reason === QTIES_REASON_MESH_3D) {
      isMesh3d = true;
      enabled = true;
    }
    // Prefer the developed (sloped) values when a guideLine ramp is present.
    computedSurface = qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
    computedLength = qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
    if (!hasPart && Number.isFinite(qties?.count)) computedUnits = qties.count;

    // Subtract the developed surface removed by a 3D boolean subtraction.
    if (!hasPart && subtractedSurfaceM2 > 0 && computedSurface != null) {
      computedSurface = Math.max(0, computedSurface - subtractedSurfaceM2);
    }
  }

  // When a part is selected we want surface to show whenever the calc returns
  // one (e.g. CUT → area), not gated on the host annotation type.
  const showSurface = isMesh3d
    ? false
    : hasPart
    ? computedSurface != null && computedSurface > 0
    : computedSurface != null &&
      computedSurface > 0 &&
      (surface != null ||
        ["RECTANGLE", "POLYGON", "STRIP"].includes(annotation?.type) ||
        (annotation?.type === "POLYLINE" &&
          (annotation?.height ||
            annotation?.shape3D?.key === "REVOLUTION" ||
            annotation?.shape3D?.key === "EXTRUSION_PROFILE" ||
            // Slope walls (parois): per-vertex offsets define a vertical band,
            // so the wall has a real lateral surface to display.
            hasPerVertexZOffsets(annotation))));

  const showLength = !isMesh3d && computedLength != null && computedLength > 0;
  const showUnits = computedUnits != null && computedUnits > 0;

  if (!enabled || (!isMesh3d && !showSurface && !showLength && !showUnits))
    return null;

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      {isMesh3d && (
        <Tooltip title={MESH_3D_QTIES_TOOLTIP}>
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", color: "warning.main", fontWeight: 500 }}
          >
            {MESH_3D_QTY_LABEL}
          </Typography>
        </Tooltip>
      )}
      {showUnits && (
        <Typography
          variant="caption"
          sx={{ fontFamily: "monospace", color: "warning.main", fontWeight: 500 }}
        >
          {computedUnits} u
        </Typography>
      )}
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
