// Warm palette + animation helpers for the dashboard (design model "2a").
// Orange accents are derived from theme.palette.secondary.main via alpha();
// the constants below are the warm neutrals of the mock.

export const PAGE_BG = "#FDFBFA";
export const CARD_BORDER = "#EDE7E3";
export const SEGMENT_BG = "#F1EBE7"; // toggle track + "Prochainement" chip
export const PILL_BORDER = "#E5DEDA"; // outlined pill buttons
export const PILL_HOVER_BG = "#F7F2EF";
export const PILL_TEXT = "#5E564F";
export const FOOTER_BORDER = "#F0EAE6";
export const STAR_COLOR = "#F2A33C"; // amber accent (favorites)
export const AMBER_GLOW = "#FFA826"; // secondary glow circle
export const TEXT_MUTED = "#8A827C";
export const TEXT_FAINT = "#9A918B";
export const TEXT_FADED = "#B8B0AA";
export const ICON_FADED = "#C9C1BB";

// sx fragments — spread into the target component's sx

export const PILL_BUTTON_SX = {
  borderRadius: 999,
  border: `1px solid ${PILL_BORDER}`,
  color: PILL_TEXT,
  bgcolor: "white",
  "&:hover": { bgcolor: PILL_HOVER_BG, borderColor: PILL_BORDER },
};

export function fadeUp(delay = 0) {
  return {
    animation: `dashboardFadeUp .5s ease ${delay}s both`,
    "@keyframes dashboardFadeUp": {
      from: { opacity: 0, transform: "translateY(18px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
  };
}

export function popIn(delay = 0) {
  return {
    animation: `dashboardPopIn .5s ease ${delay}s both`,
    "@keyframes dashboardPopIn": {
      from: { opacity: 0, transform: "scale(.85)" },
      to: { opacity: 1, transform: "scale(1)" },
    },
  };
}

export const glow = {
  animation: "dashboardGlow 6s ease-in-out infinite",
  "@keyframes dashboardGlow": {
    "0%, 100%": { opacity: 0.55 },
    "50%": { opacity: 0.9 },
  },
};
