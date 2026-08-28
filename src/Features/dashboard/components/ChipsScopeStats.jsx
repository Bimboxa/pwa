import { Box, Chip, Tooltip } from "@mui/material";
import { Layers, Pentagon } from "@mui/icons-material";

import { TEXT_MUTED } from "../utils/dashboardStyles";

// Content badges of a saved scope configuration: baseMaps count (Layers icon)
// and annotations count (Pentagon icon). Counts come from the configuration
// metadata (computeScopeStats at push time); a nullish count hides its chip,
// so rows of older versions — or a backend not echoing the fields yet — show
// nothing.

const chipSx = {
  height: 20,
  fontSize: 11,
  fontWeight: 600,
  color: TEXT_MUTED,
  bgcolor: TEXT_MUTED + "14",
  border: `1px solid ${TEXT_MUTED}33`,
  "& .MuiChip-label": { px: 0.75 },
  "& .MuiChip-icon": { fontSize: 13, ml: 0.5, color: TEXT_MUTED },
};

export default function ChipsScopeStats({ baseMapsCount, annotationsCount }) {
  const showBaseMaps = baseMapsCount !== undefined && baseMapsCount !== null;
  const showAnnotations =
    annotationsCount !== undefined && annotationsCount !== null;

  if (!showBaseMaps && !showAnnotations) return null;

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}
    >
      {showBaseMaps && (
        <Tooltip title="Fonds de plan">
          <Chip
            size="small"
            icon={<Layers />}
            label={baseMapsCount}
            sx={chipSx}
          />
        </Tooltip>
      )}
      {showAnnotations && (
        <Tooltip title="Annotations">
          <Chip
            size="small"
            icon={<Pentagon />}
            label={annotationsCount}
            sx={chipSx}
          />
        </Tooltip>
      )}
    </Box>
  );
}
