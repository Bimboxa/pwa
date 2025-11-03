import { Box, Typography, Slider } from "@mui/material";

export default function FieldCheck({ value, onChange, label, options }) {
  function handleChange(e, value) {
    onChange(value / 100);
  }

  const showAsSection = options?.showAsSection;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 0.5,
        ...(showAsSection
          ? { borderTop: (theme) => `1px solid ${theme.palette.divider}` }
          : {}),
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ pr: 2 }}>
        {label}
      </Typography>

      <Slider
        size="small"
        sx={{ flex: 1 }}
        value={value * 100}
        onChange={handleChange}
      />
    </Box>
  );
}
