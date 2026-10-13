import { Box, Switch, Tooltip, Typography } from "@mui/material";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import FieldAnnotationHeight from "./FieldAnnotationHeight";

// Geometry fields of a DISC annotation: radius, « Révolution partielle »
// switch and, when partial, the two sector bounds (degrees, plan local frame
// — same contract as the revolution axis, see discGeometry). Shared by the
// edit toolbar row and the properties panel.
const DEFAULT_ANGLE_START_DEG = 0;
const DEFAULT_ANGLE_END_DEG = 180;

const normalizeDeg = (deg) => {
  let d = Number(deg) || 0;
  d = ((d + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
};

export default function FieldsAnnotationDisc({ annotation, compact = false }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const isPartial = Boolean(annotation?.partialRevolution);

  // handlers

  // FieldAnnotationHeight echoes back the WHOLE annotation with one field
  // replaced, so pick the field explicitly. Stored radius rounded to 6
  // decimals like the drawing / handle commits.
  async function handleRadiusChange(next) {
    const raw = next?.radiusM ?? null;
    if (raw != null && !(raw > 0)) return;
    await updateAnnotation({
      id: annotation.id,
      radiusM: raw == null ? null : Math.round(raw * 1e6) / 1e6,
    });
  }

  async function handlePartialChange(checked) {
    const updates = { id: annotation.id, partialRevolution: checked };
    // First switch to partial: seed a half disc.
    if (checked && annotation.revolutionAngleStartDeg == null) {
      updates.revolutionAngleStartDeg = DEFAULT_ANGLE_START_DEG;
      updates.revolutionAngleEndDeg = DEFAULT_ANGLE_END_DEG;
    }
    await updateAnnotation(updates);
  }

  const handleAngleChange = (field) => async (next) => {
    const raw = next?.[field];
    if (raw == null || raw === "") return;
    await updateAnnotation({ id: annotation.id, [field]: normalizeDeg(raw) });
  };

  // render

  if (!annotation) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: compact ? "nowrap" : "wrap",
        gap: 0.5,
      }}
    >
      <FieldAnnotationHeight
        annotation={annotation}
        field="radiusM"
        label="rayon"
        displayDecimals={3}
        onChange={handleRadiusChange}
      />
      <Tooltip title="Révolution partielle : ne garder qu'un secteur du disque (deux angles)">
        <Box sx={{ display: "flex", alignItems: "center", p: 0.5 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            Partiel
          </Typography>
          <Switch
            size="small"
            checked={isPartial}
            onChange={(e) => handlePartialChange(e.target.checked)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </Box>
      </Tooltip>
      {isPartial && (
        <>
          <FieldAnnotationHeight
            annotation={annotation}
            field="revolutionAngleStartDeg"
            label="début"
            unit="°"
            displayDecimals={1}
            onChange={handleAngleChange("revolutionAngleStartDeg")}
          />
          <FieldAnnotationHeight
            annotation={annotation}
            field="revolutionAngleEndDeg"
            label="fin"
            unit="°"
            displayDecimals={1}
            onChange={handleAngleChange("revolutionAngleEndDeg")}
          />
        </>
      )}
    </Box>
  );
}
