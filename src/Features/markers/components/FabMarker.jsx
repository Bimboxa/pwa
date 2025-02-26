import {Paper} from "@mui/material";
import {Add} from "@mui/icons-material";

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
      }}
    >
      <Add />
    </Paper>
  );
}
