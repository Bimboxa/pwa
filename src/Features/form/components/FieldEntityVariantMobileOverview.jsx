import {Typography, Box} from "@mui/material";

export default function FieldEntityVariantMobileOverview({
  label,
  value,
  entityModel,
}) {
  console.log("[FieldEntity] value text", value);

  // helpers

  const text = value?.[entityModel.labelKey].length > 0 ? value : "-";

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
