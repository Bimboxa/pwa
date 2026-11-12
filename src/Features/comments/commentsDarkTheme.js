import { createTheme, lighten } from "@mui/material/styles";

import appTheme from "Styles/theme";

// Dark theme scoped to the comments UI shown over the editors (pills strip,
// scene pins, floating comment panel — nested ThemeProvider in
// LayerComments): the guide reads as one dark layer above the plan, whatever
// the module. The rest of the app keeps the light theme.
export const COMMENT_COLORS = {
  background: "#171717", // panel body, strip
  surface: "#212121", // header, cards, inputs
  surfaceRaised: "#2b2b2b", // hovered pill, menus
  border: "#2e2e2e",
  borderStrong: "#3d3d3d",
  text: "#ececec",
  textSecondary: "#9b9b9b",
  // single accent = the app's secondary color: fills (opened comment pill /
  // pin, main buttons). `accentText` is its light tint, for what must read
  // as text or thin line on the dark background (links, active icons).
  accent: appTheme.palette.secondary.main,
  accentContrast: "#ffffff",
  accentText: lighten(appTheme.palette.secondary.main, 0.6),
};

const commentsDarkTheme = createTheme({
  typography: {
    fontFamily: appTheme.typography.fontFamily,
    body1: { fontSize: 14, lineHeight: 1.6 },
    body2: { fontSize: 13, lineHeight: 1.5 },
    caption: { fontSize: 12, lineHeight: 1.4 },
    button: { fontSize: 12.5, fontWeight: 500, textTransform: "none" },
  },
  palette: {
    mode: "dark",
    primary: {
      main: COMMENT_COLORS.accent,
      contrastText: COMMENT_COLORS.accentContrast,
    },
    secondary: {
      main: COMMENT_COLORS.accent,
      contrastText: COMMENT_COLORS.accentContrast,
    },
    background: {
      default: COMMENT_COLORS.background,
      paper: COMMENT_COLORS.background,
    },
    text: {
      primary: COMMENT_COLORS.text,
      secondary: COMMENT_COLORS.textSecondary,
    },
    divider: COMMENT_COLORS.border,
    // Tokens read by the shared floating-panel chrome (PanelFooter,
    // PanelResizeHandle): dark counterparts of Styles/theme `panel`.
    panel: {
      headerBg: COMMENT_COLORS.surface,
      sectionBg: COMMENT_COLORS.surface,
      border: COMMENT_COLORS.border,
      textPrimary: COMMENT_COLORS.text,
      textSecondary: COMMENT_COLORS.text,
      textMuted: COMMENT_COLORS.textSecondary,
      textLight: COMMENT_COLORS.textSecondary,
      countEmpty: COMMENT_COLORS.borderStrong,
      iconMuted: COMMENT_COLORS.textSecondary,
    },
  },
  components: {
    MuiButton: {
      defaultProps: { size: "small", disableElevation: true },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { fontSize: 13, borderRadius: 8 } },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 13 } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12 } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 32 } } },
  },
});

export default commentsDarkTheme;
