import { alpha } from "@mui/material/styles";

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

// projects table (TableDashboardProjects): project | POV previews | Krtos
export const PROJECTS_TABLE_COLUMNS = "minmax(0, 1fr) 84px 118px";
export const TABLE_ROW_BG_EXPANDED = "#FBF8F6";

// sx fragments — spread into the target component's sx

export const PILL_BUTTON_SX = {
  borderRadius: 999,
  border: `1px solid ${PILL_BORDER}`,
  color: PILL_TEXT,
  bgcolor: "white",
  "&:hover": { bgcolor: PILL_HOVER_BG, borderColor: PILL_BORDER },
};

// wrapper Box around a SearchBar — white pill field with the warm glow
export const PILL_SEARCH_SX = {
  // full width even when not focused, so the placeholder is not truncated
  "& .MuiFormControl-root": { width: 1 },
  "& .MuiOutlinedInput-root": {
    bgcolor: "white",
    borderRadius: 999,
    height: 48,
    px: 1,
    boxShadow: (theme) =>
      `0 4px 20px ${alpha(
        theme.palette.secondary.main,
        0.1
      )}, 0 1px 3px rgba(0,0,0,.06)`,
    "& fieldset": { border: "none" },
  },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": {
    color: "secondary.main",
  },
};

// wrapper Box around a ToggleButtonGroup — segmented pill control (model 2a)
export const SEGMENT_TOGGLE_SX = {
  "& .MuiToggleButtonGroup-root": {
    bgcolor: SEGMENT_BG,
    borderRadius: 999,
    p: "4px",
  },
  "& .MuiToggleButton-root": {
    width: 110,
    height: 30,
    py: 0,
    border: "none",
    borderRadius: "999px !important",
    color: "text.secondary",
    "&:hover": { bgcolor: "transparent", color: "text.primary" },
  },
  "& .MuiToggleButton-root.Mui-selected": {
    bgcolor: "white",
    color: "secondary.main",
    fontWeight: 600,
    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
    "&:hover": { bgcolor: "white" },
  },
};

// wrapper Box around a ToggleButtonGroup — separate pill chips matching the
// outlined pill buttons (PILL_BUTTON_SX): white when unselected, orange tint
// when selected
export const PILL_TOGGLE_SX = {
  "& .MuiToggleButtonGroup-root": { gap: 1 },
  "& .MuiToggleButton-root": {
    height: 30,
    px: 1.5,
    py: 0,
    fontSize: 13,
    fontWeight: 500,
    textTransform: "none",
    whiteSpace: "nowrap",
    color: PILL_TEXT,
    bgcolor: "white",
    border: `1px solid ${PILL_BORDER} !important`,
    borderRadius: "999px !important",
    ml: "0 !important",
    "&:hover": { bgcolor: PILL_HOVER_BG },
  },
  "& .MuiToggleButton-root.Mui-selected": {
    color: "secondary.main",
    fontWeight: 600,
    bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
    borderColor: (theme) =>
      `${alpha(theme.palette.secondary.main, 0.5)} !important`,
    "&:hover": {
      bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
    },
  },
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

// Soft gradient card (empty-state cards, the drawing helper): warm white to a
// faint tint of `color`, with a matching hairline border.
export const softGradientCardSx = (color) => ({
  background: `linear-gradient(160deg, #FFFDFB, ${alpha(color, 0.08)})`,
  border: `1px solid ${alpha(color, 0.18)}`,
});
