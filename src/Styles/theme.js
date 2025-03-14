import {createTheme} from "@mui/material/styles";
import {
  blueGrey,
  green,
  blue,
  pink,
  grey,
  red,
  orange,
} from "@mui/material/colors";

let theme = createTheme({
  typography: {
    fontSize: 11,
    "@media (max-width:600px)": {
      fontSize: 13,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 0,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          // for TextField
          "&.MuiOutlinedInput-input": {
            padding: "8px 8px",
            lineHeight: "1.5",
          },
        },
        root: {
          // for Autocomplete
          "&.MuiOutlinedInput-root": {
            padding: "0px 0px",
          },
        },
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
    background: {
      default: "#F4F4F8",
      dark: "#F5F5F5",
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
  },
});

export default theme;
