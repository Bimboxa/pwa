import { createTheme, lighten } from "@mui/material/styles";

import appTheme from "Styles/theme";

// Dark theme scoped to the phases strip (nested ThemeProvider in
// StripPhases): the strip reads as one dark band above the editors, like the
// left band. The rest of the app — the dialogs opened from the strip
// included — keeps the light theme.
//
// - primary = the DISPLAYED phases (light fill, dark text): the app's
//   primary is a dark grey, unreadable on a dark band.
// - secondary = the period of the selected annotations: a lighter tint of
//   the app's secondary, which is too dark to stand out here.
const BACKGROUND = "#171717";
const TEXT = "#ececec";
const TEXT_SECONDARY = "#9b9b9b";
const BORDER = "#2e2e2e";

const phasingDarkTheme = createTheme({
  // same typography and component overrides (icon sizes…) as the app
  typography: appTheme.typography,
  components: appTheme.components,
  palette: {
    mode: "dark",
    primary: { main: TEXT, contrastText: BACKGROUND },
    secondary: {
      main: lighten(appTheme.palette.secondary.main, 0.3),
      contrastText: "#ffffff",
    },
    background: { default: BACKGROUND, paper: BACKGROUND },
    text: { primary: TEXT, secondary: TEXT_SECONDARY },
    divider: BORDER,
  },
});

export default phasingDarkTheme;
