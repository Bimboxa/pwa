import {Paper} from "@mui/material";
import {Add} from "@mui/icons-material";

import theme from "Styles/theme";

export default function FabMarker({marker, onClick, bgcolor, isCreating}) {
  return (
    <Paper
      sx={{
        width: isCreating ? 50 : 40,
        height: isCreating ? 50 : 40,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        borderRadius: "50%",
        cursor: "pointer",
        bgcolor,
        ...(isCreating && {border: `2px solid white`, opacity: 0.5}),
      }}
    >
      <Add sx={{color: "white"}} />
    </Paper>
  );
}
