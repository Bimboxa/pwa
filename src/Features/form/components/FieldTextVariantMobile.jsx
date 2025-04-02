import {Typography, Box} from "@mui/material";
import FieldText from "./FieldText";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldTextVariantMobile({
  value,
  lastValue,
  onChange,
  options,
  label,
  onNext,
}) {
  console.log("[FieldTextVariantMobile] autoFocus", options?.autoFocus);

  // handlers

  function handleChange(newValue) {
    if (newValue !== value) {
      onChange(newValue);
      if (onNext) onNext();
    }
  }

  return (
    <Box sx={{width: 1, p: 2, overflow: "auto"}}>
      <BoxCenter sx={{py: 1}}>
        <Typography>{label}</Typography>
      </BoxCenter>

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
