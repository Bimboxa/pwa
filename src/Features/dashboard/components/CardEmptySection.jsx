import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { TEXT_MUTED, popIn } from "../utils/dashboardStyles";

// Empty-state card used by the right-side dashboard sections
// (favorites / daily scopes) — warm gradient + halo icon (model 2a).
// `icon` is a MUI icon element; all tints derive from `iconColor`.

export default function CardEmptySection({
  icon,
  iconColor,
  title,
  hint,
  animationDelay = 0.4,
}) {
  return (
    <Box
      sx={{
        background: `linear-gradient(160deg, #FFFDFB, ${alpha(
          iconColor,
          0.08
        )})`,
        border: `1px solid ${alpha(iconColor, 0.18)}`,
        borderRadius: "16px",
        py: 4.5,
        px: 3.5,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: 84,
          height: 84,
          mx: "auto",
          ...popIn(animationDelay),
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(
              iconColor,
              0.22
            )}, ${alpha(iconColor, 0)} 70%)`,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: "14px",
            borderRadius: "50%",
            bgcolor: "white",
            boxShadow: `0 4px 14px ${alpha(iconColor, 0.25)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography sx={{ fontWeight: 600, mt: 1.75 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ color: TEXT_MUTED, mt: 0.75, lineHeight: 1.5 }}
      >
        {hint}
      </Typography>
    </Box>
  );
}
