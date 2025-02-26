import {Paper} from "@mui/material";
import {Add} from "@mui/icons-material";

import theme from "Styles/theme";

export default function FabMarker({marker, onClick}) {
  return (
    <Paper
      sx={{
        width: 40,
        height: 40,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: "50%",
        cursor: "pointer",
        bgcolor: theme.palette.marker.default,
      }}
    >
      <Add sx={{color: "white"}} />
    </Paper>
  );
}
