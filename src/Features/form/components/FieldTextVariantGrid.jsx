import {Autocomplete, TextField, Box, Grid2, Typography} from "@mui/material";

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
    <Grid2
      container
      sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
    >
      <Grid2 size={12 - size} sx={{p: 1, bgcolor: "background.default"}}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid2>
      <Grid2 size={size}>
        <TextField
          fullWidth
          multiline={options?.multiline}
          value={value ?? ""}
          onChange={handleChange}
        />
      </Grid2>
    </Grid2>
  );
}
