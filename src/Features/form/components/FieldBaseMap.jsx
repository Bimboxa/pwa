import { Box, Typography } from "@mui/material";

import ListBaseMapsVariantGrid from "Features/baseMaps/components/ListBaseMapsVariantGrid";

export default function FieldBaseMap({
  value,
  onChange,
  baseMaps,
  label,
  formContainerRef,
  createContainerEl,
}) {
  // helper

  console.log("[FieldBaseMap] value", value);
  const selection = value ? [value.id] : [];

  // handlers

  function handleClick(baseMap) {
    console.log("[FieldBaseMap] handleClick", baseMap);
    onChange(baseMap);
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption">{label}</Typography>
      <ListBaseMapsVariantGrid
        baseMaps={baseMaps}
        createContainerEl={createContainerEl}
        selection={selection}
        onClick={handleClick}
      />
    </Box>
  );
}
