import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";

import useSegmentsExtEdge from "Features/points/hooks/useSegmentsExtEdge";

import AnnotationMeasurements from "./AnnotationMeasurements";

export default function SectionAnnotationPartPropertiesContent({ annotation, part }) {
  const { checked, indeterminate, toggle } = useSegmentsExtEdge();

  if (!part || part.kind === "NONE") return null;

  const points = part.geometryPx || part.pointRefs || [];
  const isClosed = part.kind === "CUT";
  const isSegmentPart = part.kind === "SEGMENT" || part.kind === "SEGMENTS";

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} alignItems="baseline">
          <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 90 }}>
            Type
          </Typography>
          <Typography variant="body2">{part.captionFr}</Typography>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="baseline">
          <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 90 }}>
            Détail
          </Typography>
          <Typography variant="body2">{part.label}</Typography>
        </Stack>

        {points.length > 0 && (
          <Stack direction="row" spacing={2} alignItems="baseline">
            <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 90 }}>
              Points
            </Typography>
            <Typography variant="body2">
              {points.length}
              {isClosed ? " (ring fermé)" : ""}
            </Typography>
          </Stack>
        )}

        {part.kind === "SEGMENTS" && part.contiguous === false && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Segments non contigus — la duplication créera {part.chains?.length ?? 0} polyline{(part.chains?.length ?? 0) > 1 ? "s" : ""} (une par chaîne).
          </Typography>
        )}

        <Stack direction="row" spacing={2} alignItems="baseline">
          <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 90 }}>
            Mesures
          </Typography>
          <AnnotationMeasurements annotation={annotation} part={part} />
        </Stack>

        {isSegmentPart && (
          <FormControlLabel
            control={
              <Checkbox
                checked={checked}
                indeterminate={indeterminate}
                onChange={toggle}
                size="small"
              />
            }
            label={<Typography variant="body2">Segment extérieur</Typography>}
          />
        )}
      </Stack>
    </Box>
  );
}
