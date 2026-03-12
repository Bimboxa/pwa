import { createTheme } from "@mui/material/styles";
import {
  blueGrey,
  green,
  blue,
  pink,
  grey,
  red,
  orange,
  purple,
  teal,
} from "@mui/material/colors";
import { frFR } from "@mui/x-data-grid-pro/locales";

let theme = createTheme(
  {
    components: {
      MuiSvgIcon: {
        styleOverrides: {
          root: {
            // On force la taille de base (medium) à être celle du "small" par défaut
            fontSize: "1rem", // correspond environ à 20px
          },
          fontSizeSmall: {
            fontSize: "0.875rem", // On réduit aussi le small (environ 16px) pour garder une hiérarchie
          },
          fontSizeLarge: {
            fontSize: "1.25rem", // On passe le large à 24px (l'ancienne taille medium)
          }
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: "8px",
          },
          contained: {
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            // Configuration pour l'état "checked" (actif)
            "&.Mui-checked": {
              color: orange[500], // Le bouton rond devient vert
              "&:hover": {
                // Petit halo vert au survol quand c'est coché
                backgroundColor: "rgba(76, 175, 80, 0.08)",
              },
            },
            // Configuration de la barre (track) quand "checked"
            "&.Mui-checked + .MuiSwitch-track": {
              backgroundColor: orange[500], // La barre devient verte
              opacity: 0.5, // Opacité standard de MUI
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          // input: {
          //   // for TextField
          //   "&.MuiOutlinedInput-input": {
          //     padding: "8px 8px",
          //     lineHeight: "1.5",
          //   },
          // },
          // root: {
          //   // for Autocomplete
          //   "&.MuiOutlinedInput-root": {
          //     padding: "0px 0px",
          //   },
          // },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            p: 0,
            m: 0,
          },
        },
      },
      MuiList: {
        styleOverrides: {
          root: {
            padding: 0,
          },
        },
      },
    },
    palette: {
      primary: {
        main: grey[800],
        //main: "#e85426",
      },
      secondary: {
        //main: blueGrey[600],
        main: "#e85426",
        // main: purple[600],
      },
      background: {
        default: "#F4F4F8",
        dark: "#F5F5F5",
      },
      editor: {
        selected: "#39FF14", // Flash green (Stabilo Boss-like)
      },
      shape: {
        default: blueGrey[500],
        selected: green[500],
      },
      marker: {
        default: orange[600],
      },
      viewers: {
        map: blue[600],
        threed: pink[600],
        portfolio: purple[600],
        admin: teal[700],
        listing: green[600],
      },
      anchor: {
        default: red[500],
        selected: red[800],
      },
      button: {
        dark: grey[800],
      },
      entities: {
        article: green[500],
        shape: blueGrey[500],
      },
      baseMap: {
        hovered: "#9CFF8A", // Light flash green
      },
      annotation: {
        selected: "#39FF14", // Flash green tone
        selectedPart: "#2fff14ff", // Flash
        segmentHover: "#FFB6C1", // Light pink flash
        segmentSelected: "#FF1493", // Flash pink (DeepPink)
      },
      anchor: {
        passive: grey[500],
        active: red[500],
      },
      panel: {
        headerBg: "#fafafa",
        sectionBg: "#f5f5fb",
        border: "#eaeaf5",
        textPrimary: "#1a1a2e",
        textSecondary: "#3d3d4e",
        textMuted: "#7070a0",
        textLight: "#b0b0c8",
        countEmpty: "#d0d0e0",
        iconMuted: "#9090a8",
      },
    },
    typography: {
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 13,
      button: {
        textTransform: "none",
        fontWeight: 500,
      },
    },
  },
  frFR
);

export default theme;
