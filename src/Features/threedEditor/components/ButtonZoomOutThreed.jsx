import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { IconButton, Paper, Tooltip } from "@mui/material";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

// Fire-and-forget button: re-frame the camera so it encompasses all annotations
// currently shown in the scene (the useAnnotationsV2 set). With no annotation it
// frames a 10 m cube at the world center (see ControlsManager.fitToAnnotations).
// Self-positioned at the bottom-right corner of the 3D editor so it stays
// available whatever bottom toolbar is active (drawing, meshing, extrude, …).
export default function ButtonZoomOutThreed() {
  // handlers

  function handleClick() {
    getActiveThreedEditor()?.fitToAnnotations?.();
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        right: 16,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Tooltip title="Zoom out">
        <IconButton size="small" color="inherit" onClick={handleClick}>
          <ZoomOutMapIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
