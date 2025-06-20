import {Typography, Box} from "@mui/material";

export default function FieldQrcodeVariantMobileOverview({label, value}) {
  // helpers

  const text = value?.length > 0 ? value : "-";

  return (
    <Box sx={{width: 1}}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{whiteSpace: "pre"}}
      >
        {label}
      </Typography>
      <Typography sx={{whiteSpace: "pre-line"}}>{text}</Typography>
    </Box>
  );
}
