import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { IconButton, Paper, Tooltip } from "@mui/material";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

// Fire-and-forget button: re-frame the camera so it encompasses all annotations
// currently shown in the scene (the useAnnotationsV2 set). With no annotation it
// frames a 10 m cube at the world center (see ControlsManager.fitToAnnotations).
// Positioned by its parent — the bottom-right overlay group of MainThreedEditor,
// outside the bottom-toolbar swap so it stays available whatever toolbar is
// active (drawing, meshing, extrude, …).
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
        borderRadius: "10px",
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
