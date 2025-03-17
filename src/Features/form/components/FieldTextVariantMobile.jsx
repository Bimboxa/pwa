import {Autocomplete, TextField, Box} from "@mui/material";

export default function FieldTextVariantMobile({
  value,
  onChange,
  options,
  label,
}) {
  // handlers

  function handleChange(event) {
    const newValue = event.target.value;
    onChange(newValue);
  }

  return (
    <Box sx={{width: 1, p: 2, overflow: "auto"}}>
      <TextField
        multiline={options?.multiline}
        autoFocus
        label={label}
        fullWidth
        value={value ?? ""}
        onChange={handleChange}
      />
    </Box>
  );
}
