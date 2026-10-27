import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { AMBER_GLOW, glow } from "../utils/dashboardStyles";

// Decorative backdrop of the dashboard (model 2a): warm gradient band at the
// top and two orange glows. Absolutely positioned, pointer-events none: the
// parent is `position: relative; overflow: hidden` with bgcolor PAGE_BG.
// Shared with the « Démarrer avec Krto » dialog (Features/starting).
export default function BackgroundDashboard() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 340,
          pointerEvents: "none",
          background: (theme) =>
            `linear-gradient(180deg, ${alpha(
              theme.palette.secondary.main,
              0.1
            )} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 70%, ${alpha(
              theme.palette.secondary.main,
              0
            )} 100%)`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 520,
          height: 520,
          borderRadius: "50%",
          pointerEvents: "none",
          background: (theme) =>
            `radial-gradient(circle, ${alpha(
              theme.palette.secondary.main,
              0.14
            )} 0%, ${alpha(theme.palette.secondary.main, 0)} 70%)`,
          ...glow,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: -60,
          left: "22%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          pointerEvents: "none",
          background: `radial-gradient(circle, ${alpha(
            AMBER_GLOW,
            0.12
          )} 0%, ${alpha(AMBER_GLOW, 0)} 70%)`,
        }}
      />
    </>
  );
}
