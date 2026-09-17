import { createTheme } from "@mui/material/styles";

import appTheme from "Styles/theme";

// Dark theme scoped to the chat panel (nested ThemeProvider in PanelChat):
// every MUI control inside — text field, select and its menu, checkbox,
// buttons, chips — follows it; the rest of the app keeps the light theme.
export const CHAT_COLORS = {
  background: "#171717",
  surface: "#212121", // assistant bubbles, cards
  surfaceRaised: "#2b2b2b", // user bubble, selector pill, input
  border: "#2e2e2e",
  text: "#ececec",
  textSecondary: "#9b9b9b",
};

const chatDarkTheme = createTheme({
  components: appTheme.components,
  typography: { fontFamily: appTheme.typography.fontFamily },
  palette: {
    mode: "dark",
    primary: { main: "#d6d6d6" },
    secondary: appTheme.palette.secondary,
    background: {
      default: CHAT_COLORS.background,
      paper: CHAT_COLORS.surface,
    },
    text: {
      primary: CHAT_COLORS.text,
      secondary: CHAT_COLORS.textSecondary,
    },
    divider: CHAT_COLORS.border,
  },
});

export default chatDarkTheme;
