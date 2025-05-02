import {Typography, Box} from "@mui/material";
import getNodeById from "Features/tree/utils/getNodeById";

export default function FieldCategoryVariantMobileOverview({
  label,
  value,
  nomenclature,
}) {
  console.log("[FieldText] value text", value);

  // helpers

  const category = getNodeById(value?.id, nomenclature?.items);
  const text = category?.label ?? "-";

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
