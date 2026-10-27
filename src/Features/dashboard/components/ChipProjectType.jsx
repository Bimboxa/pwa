import { Chip } from "@mui/material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { getProjectTypeProps } from "../utils/projectTypes";

export default function ChipProjectType({ type }) {
  // data

  const appConfig = useAppConfig();

  // strings

  const typeLabels = appConfig?.strings?.project?.typeLabels;
  const projectS = appConfig?.strings?.project?.nameSingular ?? "Projet";

  // helpers

  const { key, color } = getProjectTypeProps(type);
  const label = typeLabels?.[type] ?? typeLabels?.[key] ?? projectS;

  // render

  if (!type) return null;

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
