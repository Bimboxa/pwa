import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";

export default function RadioButtonGeneric({
  label,
  options,
  value,
  onChange,
  row,
}) {
  // handlers

  function handleChange(event) {
    onChange(event.target.value);
  }

  // render

  return (
    <FormControl sx={{ p: 1 }}>
      <FormLabel>{label}</FormLabel>
      <RadioGroup row={row} value={value} onChange={handleChange}>
        {options.map((option) => {
          return (
            <FormControlLabel
              key={option.key}
              value={option.key}
              control={<Radio size="small" />}
              label={option.label}
            />
          );
        })}
      </RadioGroup>
    </FormControl>
  );
}
