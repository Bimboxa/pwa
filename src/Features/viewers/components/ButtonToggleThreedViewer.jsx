import { useDispatch, useSelector } from "react-redux";

import { setSelectedViewerKey } from "../viewersSlice";

import { IconButton, Typography, Paper } from "@mui/material";

export default function ButtonToggleThreedViewer() {
  const dispatch = useDispatch();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const enabled = useSelector((s) => s.threedEditor.enabled);

  const isThreed = selectedViewerKey === "THREED";

  function handleClick() {
    dispatch(setSelectedViewerKey(isThreed ? "MAP" : "THREED"));
  }

  if (!enabled) return null;

  return (
    <Paper
      sx={{
        borderRadius: "8px",
        bgcolor: "secondary.main",
        width: "30px",
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconButton onClick={handleClick} sx={{ borderRadius: "8px" }}>
        <Typography variant="body2" color="white">
          {isThreed ? "2D" : "3D"}
        </Typography>
      </IconButton>
    </Paper>
  );
}
