import SelectorMarkerIcon from "Features/markers/components/SelectorMarkerIcon";

import { Box, Typography } from "@mui/material";

export default function FieldIcon({
  value,
  onChange,
  label,
  spriteImage,
  options,
}) {
  const iconColor = options?.iconColor;

  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
        <SelectorMarkerIcon
          iconKey={value}
          onChange={onChange}
          spriteImage={spriteImage}
          iconColor={iconColor}
        />
      </Box>
    </Box>
  );
}
