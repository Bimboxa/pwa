import { Box, Typography } from "@mui/material";

import SelectorIconGeneric from "Features/layout/components/SelectorIconGeneric";

export default function FieldIconBasic({ value, onChange, label, options }) {
  const iconsMap = options?.iconsMap;
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
        <SelectorIconGeneric
          iconKey={value}
          iconColor={iconColor}
          onChange={onChange}
          iconsMap={iconsMap}
        />
      </Box>
    </Box>
  );
}
