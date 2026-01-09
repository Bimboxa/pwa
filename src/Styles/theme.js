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
} from "@mui/material/colors";
import { frFR } from "@mui/x-data-grid-pro/locales";

let theme = createTheme(
  {
    components: {
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
      }
    },
    typography: {
      fontSize: 11,
      h1: {
        fontSize: "2rem", // Default for larger screens
        "@media (max-width:600px)": {
          fontSize: "2.5rem", // 🔥 Bigger font on small screens
        },
      },
      h2: {
        fontSize: "1.5rem", // Default for large screens
        "@media (max-width:600px)": {
          fontSize: "2rem", // 🔥 Bigger font on small screens
        },
      },
      body1: {
        fontSize: "1rem", // Default for large screens
        "@media (max-width:600px)": {
          fontSize: "1.25rem", // 🔥 Bigger font on small screens
        },
      },
      body2: {
        fontSize: "0.875rem", // Default
        "@media (max-width:600px)": {
          fontSize: "1rem", // 🔥 Larger on small screens
        },
      },
      caption: {
        fontSize: "0.75rem", // Default
        "@media (max-width:600px)": {
          fontSize: "0.875rem", // 🔥 Larger on small screens
        },
      },
    },
  },
  frFR
);

export default theme;
