import { createTheme } from "@mui/material/styles";

import appTheme from "Styles/theme";

// Dark theme scoped to the chat panel (nested ThemeProvider in PanelChat):
// every MUI control inside — text field, select and its menu, checkbox,
// buttons, chips — follows it; the rest of the app keeps the light theme.
export const CHAT_COLORS = {
  background: "#171717",
  surface: "#212121", // cards, input
  surfaceRaised: "#2b2b2b", // user bubble, menus
  border: "#2e2e2e",
  borderStrong: "#3d3d3d", // input outline
  text: "#ececec",
  textSecondary: "#9b9b9b",
  code: "#f0907a", // inline `code`
};

// Type scale of the chat, in px (the app theme scales MUI's defaults with
// `fontSize: 13`, which leaves body1 near 15 px — too big for a side panel).
// One place to tune: messages 14, tool lines / controls 13, meta 12.
export const CHAT_FONT = {
  message: 14,
  control: 13,
  meta: 12,
  button: 12.5,
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const appComponents = appTheme.components ?? {};

const chatDarkTheme = createTheme({
  typography: {
    fontFamily: appTheme.typography.fontFamily,
    body1: { fontSize: CHAT_FONT.message, lineHeight: 1.55 },
    body2: { fontSize: CHAT_FONT.control, lineHeight: 1.5 },
    caption: { fontSize: CHAT_FONT.meta, lineHeight: 1.4 },
    button: {
      fontSize: CHAT_FONT.button,
      lineHeight: 1.4,
      fontWeight: 500,
      textTransform: "none",
    },
  },
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
  components: {
    ...appComponents,
    // Small, quiet buttons: the chat is text first.
    MuiButton: {
      ...appComponents.MuiButton,
      defaultProps: { size: "small", disableElevation: true },
      styleOverrides: {
        ...appComponents.MuiButton?.styleOverrides,
        // Quiet text buttons ("Annuler", "Nouvelle session"…): muted until
        // hovered, whatever they sit in.
        root: ({ ownerState }) => ({
          ...appComponents.MuiButton?.styleOverrides?.root,
          ...(ownerState.variant === "text" && ownerState.color === "inherit"
            ? {
                color: CHAT_COLORS.textSecondary,
                "&:hover": {
                  color: CHAT_COLORS.text,
                  backgroundColor: "rgba(255,255,255,0.06)",
                },
              }
            : {}),
        }),
        sizeSmall: {
          fontSize: CHAT_FONT.button,
          lineHeight: 1.4,
          padding: "4px 10px",
          minWidth: 0,
        },
        textSizeSmall: { padding: "4px 8px" },
        startIcon: { marginRight: 4 },
      },
    },
    MuiChip: {
      styleOverrides: {
        sizeSmall: { height: 22, fontSize: CHAT_FONT.meta },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: CHAT_FONT.control, minHeight: 32 },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: { padding: 4, "& .MuiSvgIcon-root": { fontSize: 16 } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: CHAT_FONT.control, borderRadius: 8 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: CHAT_FONT.control } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: CHAT_FONT.meta } },
    },
  },
});

export default chatDarkTheme;
