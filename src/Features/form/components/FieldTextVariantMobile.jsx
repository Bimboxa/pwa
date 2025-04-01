import {Autocomplete, TextField, Box} from "@mui/material";
import FieldText from "./FieldText";

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
      <FieldText
        value={value}
        onChange={onChange}
        options={{...options, fullWidth: true}}
        label={label}
      />
    </Box>
  );
}
