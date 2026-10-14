import { MenuItem, TextField, Typography } from "@mui/material";

import useRevolutionAxisOptions from "../hooks/useRevolutionAxisOptions";

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

  const options = useRevolutionAxisOptions();

  // helpers

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
