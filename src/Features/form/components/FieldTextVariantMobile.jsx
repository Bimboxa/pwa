import {Autocomplete, TextField, Box} from "@mui/material";

export default function FieldTextVariantMobile({
  value,
  onChange,
  options,
  label,
}) {
  console.log("[FieldText] value", value);
  // handlers

  function handleChange(event, newValue) {
    console.log("[FieldText] newValue", newValue);
    onChange(newValue);
  }

  return (
    <Box sx={{width: 1, p: 2}}>
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
