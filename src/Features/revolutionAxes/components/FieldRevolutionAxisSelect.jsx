import { useMemo } from "react";

import { MenuItem, TextField, Typography } from "@mui/material";

import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

// strings

const DEFAULT_LABEL = "Axe de révolution";
const NO_AXIS = "Dessinez d'abord un axe de révolution sur une vue en plan.";

/**
 * Select of the revolution axes of the current scope (plan axes), each
 * labelled by its name and the plan it is drawn on. Value = axis id ("" when
 * none). Shows a hint instead of the select while the scope holds no axis.
 */
export default function FieldRevolutionAxisSelect({
  value,
  onChange,
  label = DEFAULT_LABEL,
  disabled = false,
  helperText = null,
  size = "small",
  sx,
}) {
  // data

  const axes = useRevolutionAxes();
  const { value: baseMaps } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });

  // helpers

  const baseMapNameById = useMemo(() => {
    const acc = new Map();
    for (const bm of baseMaps ?? []) acc.set(bm.id, bm.name);
    return acc;
  }, [baseMaps]);

  const options = useMemo(
    () =>
      [...axes]
        .sort((a, b) =>
          String(a.label ?? "").localeCompare(
            String(b.label ?? ""),
            undefined,
            {
              numeric: true,
            }
          )
        )
        .map((axis) => ({
          id: axis.id,
          label: [axis.label ?? "Axe", baseMapNameById.get(axis.baseMapId)]
            .filter(Boolean)
            .join(" · "),
        })),
    [axes, baseMapNameById]
  );

  const safeValue = options.some((o) => o.id === value) ? value : "";

  // render

  if (options.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={sx}>
        {NO_AXIS}
      </Typography>
    );
  }

  return (
    <TextField
      select
      size={size}
      fullWidth
      label={label}
      value={safeValue}
      onChange={(e) => onChange?.(e.target.value || null)}
      disabled={disabled}
      helperText={helperText}
      sx={sx}
    >
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id} dense>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
