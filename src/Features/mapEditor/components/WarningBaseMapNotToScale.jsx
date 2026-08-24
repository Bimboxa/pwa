import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WarningAmber from "@mui/icons-material/WarningAmber";

// ---------------------------------------------------------------------------
// WarningBaseMapNotToScale — banner shown when the base map has no scale
// (no meterByPx): measures are unreliable.
// ---------------------------------------------------------------------------

export default function WarningBaseMapNotToScale({ sx }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mx: 1,
        mt: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
        border: "1px solid",
        borderColor: (theme) => alpha(theme.palette.error.main, 0.3),
        ...sx,
      }}
    >
      <WarningAmber sx={{ fontSize: 18, color: "error.main", flexShrink: 0 }} />
      <Typography
        variant="caption"
        sx={{ color: "error.main", fontWeight: 500, lineHeight: 1.3 }}
      >
        Ce plan n'est pas à l'échelle. Les mesures ne seront pas fiables.
      </Typography>
    </Box>
  );
}
