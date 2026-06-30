import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { Button, Tooltip } from "@mui/material";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

// Fire-and-forget button: re-frame the camera so it encompasses all annotations
// currently shown in the scene (the useAnnotationsV2 set). With no annotation it
// frames a 10 m cube at the world center (see ControlsManager.fitToAnnotations).
export default function ButtonZoomOutThreed() {
  // handlers

  function handleClick() {
    getActiveThreedEditor()?.fitToAnnotations?.();
  }

  // render

  return (
    <Tooltip title="Vue d'ensemble — englober toutes les annotations">
      <Button
        variant="outlined"
        color="inherit"
        onClick={handleClick}
        startIcon={<ZoomOutMapIcon sx={{ fontSize: 18 }} />}
        size="small"
        sx={{ textTransform: "none", borderRadius: "8px" }}
      >
        Zoom out
      </Button>
    </Tooltip>
  );
}
