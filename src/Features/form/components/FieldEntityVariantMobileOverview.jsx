import {Typography, Box} from "@mui/material";

export default function FieldEntityVariantMobileOverview({
  label,
  value,
  entities,
}) {
  //

  const entity = entities?.find((entity) => entity.id === value?.id);

  // helpers

  const text = entity?.label ?? "-";

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
