import { Box, Typography, Slider } from "@mui/material";

export default function FieldCheck({ value, onChange, label }) {
  function handleChange(e, value) {
    onChange(value / 100);
  }
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        p: 1,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography sx={{ px: 2 }}>{label}</Typography>

      <Slider
        size="small"
        sx={{ flex: 1 }}
        value={value * 100}
        onChange={handleChange}
      />
    </Box>
  );
}
