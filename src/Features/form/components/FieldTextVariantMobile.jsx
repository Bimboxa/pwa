import {Autocomplete, TextField, Box} from "@mui/material";
import FieldText from "./FieldText";

export default function FieldTextVariantMobile({
  value,
  lastValue,
  onChange,
  options,
  label,
  onNext,
}) {
  // handlers

  function handleChange(newValue) {
    onChange(newValue);
    if (onNext) onNext();
  }

  return (
    <Box sx={{width: 1, p: 2, overflow: "auto"}}>
      <FieldText
        value={value}
        lastValue={lastValue}
        onChange={handleChange}
        options={{...options, fullWidth: true}}
        label={label}
      />
    </Box>
  );
}
