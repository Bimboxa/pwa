import { CompactPicker, CirclePicker } from "react-color";
import { Box, Typography } from "@mui/material";

export default function FieldColorV2({ value, onChange, label }) {
  // handlers

  function handleColorChange(color) {
    console.log("color", color.hex);
    onChange(color.hex);
  }

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

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
          width: 1,
        }}
      >
        <CirclePicker onChange={handleColorChange} color={value} />
      </Box>
    </Box>
  );
}
