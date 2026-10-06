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

// One stat chip: family icon + count. Shared with the SCOPE module listing
// selector (RowListingInGroup, ButtonSelectorListingInViewer), so a listing
// row there reads like a scope row of the dashboard. `tooltip` is optional.
export function ChipScopeStat({ icon, label, tooltip, sx }) {
  const chip = (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={[chipSx, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
  if (!tooltip) return chip;
  return <Tooltip title={tooltip}>{chip}</Tooltip>;
}

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
        <ChipScopeStat
          icon={<Layers />}
          label={baseMapsCount}
          tooltip="Fonds de plan"
        />
      )}
      {showAnnotations && (
        <ChipScopeStat
          icon={<Pentagon />}
          label={annotationsCount}
          tooltip="Annotations"
        />
      )}
    </Box>
  );
}
