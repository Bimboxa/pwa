import { Box, Typography } from "@mui/material";

export default function HelperScale({ meterByPx, worldK, basePoseK }) {
  // strings
  const noScaleS = "Echelle non définie";

  // Define scale steps in meters (from smallest to largest)
  const scaleSteps = [
    { meters: 0.01, label: "1 cm" },
    { meters: 0.05, label: "5 cm" },
    { meters: 0.1, label: "10 cm" },
    { meters: 0.5, label: "50 cm" },
    { meters: 1, label: "1 m" },
    { meters: 5, label: "5 m" },
    { meters: 10, label: "10 m" },
    { meters: 50, label: "50 m" },
    { meters: 100, label: "100 m" },
    { meters: 500, label: "500 m" },
    { meters: 1000, label: "1 km" },
  ];

  // Calculate effective scale factor (screen pixels per baseMap pixel)
  const totalScale = (worldK || 1) * (basePoseK || 1);

  // Target width in screen pixels
  const targetWidthPx = 200;

  // Calculate which scale step to show
  let selectedStep = scaleSteps[0];
  let width = "100px";
  let label = selectedStep.label;

  if (meterByPx && totalScale > 0) {
    // Calculate how many screen pixels are needed to represent each scale step
    // For each meter value, calculate: pixels in baseMap = meters / meterByPx
    // Then convert to screen pixels = baseMap pixels * totalScale

    // Find the scale step that results in width closest to targetWidthPx
    let bestDiff = Infinity;

    for (const step of scaleSteps) {
      // How many pixels in baseMap for this many meters
      const baseMapPixels = step.meters / meterByPx;
      // How many screen pixels
      const screenPixels = baseMapPixels * totalScale;

      // Find the step closest to target width
      const diff = Math.abs(screenPixels - targetWidthPx);
      if (diff < bestDiff) {
        bestDiff = diff;
        selectedStep = step;
        width = `${Math.round(screenPixels)}px`;
        label = step.label;
      }

      // If we're past the target and getting further, stop
      if (screenPixels > targetWidthPx && diff > bestDiff) {
        break;
      }
    }
  }

  // render

  if (!meterByPx)
    return (
      <Box
        sx={{
          borderRadius: "14px",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 1,
          bgcolor: "white",
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ userSelect: "none" }}
        >
          {noScaleS}
        </Typography>
      </Box>
    );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        height: "28px",
      }}
    >
      <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", position: "relative" }}>
        {/* Left vertical segment */}
        <Box
          sx={{
            width: "1px",
            height: "5px",
            bgcolor: "black",
          }}
        />
        {/* Horizontal line */}
        <Box sx={{ width, height: "1px", bgcolor: "black" }} />
        {/* Right vertical segment */}
        <Box
          sx={{
            width: "1px",
            height: "5px",
            bgcolor: "black",
          }}
        />
      </Box>
    </Box>
  );
}
