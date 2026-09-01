import { Box, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function CardCreateBaseMapOption({
  title,
  subtitle,
  illustration,
  actions,
  badge,
  disabled,
}) {
  // render

  return (
    <Box
      sx={{
        width: 172,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      {badge && (
        <Chip
          label={badge}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
            fontWeight: 500,
            color: "secondary.main",
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
          }}
        />
      )}

      <Box
        sx={{
          width: 1,
          height: 110,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          overflow: "hidden",
          display: "flex",
          ...(disabled && { opacity: 0.55 }),
        }}
      >
        {illustration}
      </Box>

      <Typography
        variant="body2"
        sx={{ fontWeight: 600, mt: 1.5, ...(disabled && { opacity: 0.55 }) }}
      >
        {title}
      </Typography>

      <Typography
        variant="caption"
        sx={{ color: "text.secondary", ...(disabled && { opacity: 0.55 }) }}
      >
        {subtitle}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
        {actions}
      </Box>
    </Box>
  );
}
