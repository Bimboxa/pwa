import {Autocomplete, TextField, Box} from "@mui/material";

export default function FieldTextVariantToolbar({
  value,
  onChange,
  options,
  label,
  width,
  placeholder,
}) {
  console.log("[FieldText] value", value);
  // handlers

  function handleChange(event, newValue) {
    console.log("[FieldText] newValue", newValue);
    onChange(newValue);
  }

  return (
    <Box sx={{width}}>
      <Autocomplete
        freeSolo
        fullWidth
        inputValue={value}
        onInputChange={handleChange}
        options={options ?? []}
        renderInput={(params) => <TextField {...params} label={label} />}
      />
    </Box>
  );
}
