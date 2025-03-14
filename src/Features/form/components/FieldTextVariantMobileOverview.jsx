import {Typography, Box} from "@mui/material";

export default function FieldTextVariantMobileOverview({label, value}) {
  console.log("[FieldText] value text", value);

  // helpers

  const text = value ?? "-";

  // handlers

  function handleChange(event) {
    const newValue = event.target.value;
    onChange(newValue);
  }

  return (
    <Box sx={{width: 1}}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{whiteSpace: "pre"}}>{text}</Typography>
    </Box>
  );
}
