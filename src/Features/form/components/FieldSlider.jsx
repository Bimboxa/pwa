import { Box, Typography, Slider } from "@mui/material";

export default function FieldSlider({ value, onChange, label, options }) {
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
        pl: 1,
        width: 1,

        ...(showAsSection
          ? {
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            p: 1,
            pr: 2,
          }
          : {}),
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ pr: 2 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flex: 1, minWidth: 0, pr: 2 }}>
        <Slider
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
          value={value != null ? value * 100 : 100}
          onChange={handleChange}
        />
      </Box>
    </Box>
  );
}
