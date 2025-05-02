import {Typography, Box} from "@mui/material";

export default function FieldOptionVariantMobileOverview({label, value}) {
  // helpers

  const text = value?.label ?? "-";

  return (
    <Box sx={{width: 1}}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{whiteSpace: "pre"}}
      >
        {label}
      </Typography>
      <Typography sx={{whiteSpace: "pre"}}>{text}</Typography>
    </Box>
  );
}
