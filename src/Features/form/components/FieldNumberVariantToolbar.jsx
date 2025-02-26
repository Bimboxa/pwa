import {TextField, Box} from "@mui/material";

export default function FieldNumberVariantToolbar({
  value,
  onChange,
  width,
  label,
}) {
  // handlers

  function handleChange(e) {
    const value = e.target.value;
    const number = value.replace(",", ".");
    onChange(number);
  }
  return (
    <Box sx={{width}}>
      <TextField
        fullWidth
        value={value ?? ""}
        onChange={handleChange}
        label={label}
      />
    </Box>
  );
}
