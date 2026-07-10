import { Chip } from "@mui/material";

import { getProjectTypeProps } from "../utils/projectTypes";

export default function ChipProjectType({ type }) {
  if (!type) return null;

  const { label, color } = getProjectTypeProps(type);

  return (
    <Chip
      size="small"
      label={label}
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        bgcolor: color + "14",
        border: `1px solid ${color}33`,
        "& .MuiChip-label": { px: 0.9 },
      }}
    />
  );
}
