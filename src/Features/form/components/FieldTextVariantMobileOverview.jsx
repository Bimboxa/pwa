import {Typography, Box} from "@mui/material";

export default function FieldTextVariantMobileOverview({label, value}) {
  console.log("[FieldText] value text", value);

  // helpers

  const text = value ?? "-";

  return (
    <Box sx={{width: 1}}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{whiteSpace: "pre"}}
      >
        {label}
      </Typography>
      <Typography sx={{whiteSpace: "pre"}}>{text}</Typography>
    </Box>
  );
}
