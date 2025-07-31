import { Autocomplete, TextField, Box, Grid, Typography } from "@mui/material";

export default function FieldTextVariantGrid({
  value,
  onChange,
  options,
  label,
  size = 8,
}) {
  // handlers

  function handleChange(event) {
    const newValue = event.target.value;
    onChange(newValue);
  }

  return (
    <Grid
      container
      sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Grid size={12 - size} sx={{ p: 1, bgcolor: "background.default" }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid>
      <Grid size={size}>
        <TextField
          fullWidth
          multiline={options?.multiline}
          value={value ?? ""}
          onChange={handleChange}
        />
      </Grid>
    </Grid>
  );
}
