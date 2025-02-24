import {createTheme} from "@mui/material/styles";
import {blueGrey, green, blue, pink} from "@mui/material/colors";

let theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 0,
        },
      },
    },
  },
  typography: {
    fontSize: 11,
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
    viewers: {
      map: blue[600],
      threed: pink[600],
    },
  },
});

export default theme;
