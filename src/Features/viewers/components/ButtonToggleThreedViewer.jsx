import { useSelector } from "react-redux";

import useSelectedViewer from "../hooks/useSelectedViewer";
import useToggleModuleEditor from "../hooks/useToggleModuleEditor";
import useTogglePovViewerMode from "Features/pov/hooks/useTogglePovViewerMode";
import { selectEffectiveViewerKey } from "../utils/effectiveViewerKey";

import { Button, Typography } from "@mui/material";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";

// Toggles the 2D/3D editor displayed inside the current module — the
// left-band (module) selection does not move. Rendered only in multi-editor
// modules (Dessin, POV); single-editor modules (THREED recap, MESHES, ...)
// have no toggle.
export default function ButtonToggleThreedViewer() {
  const toggleModuleEditor = useToggleModuleEditor();
  const togglePovViewerMode = useTogglePovViewerMode();

  const selectedViewer = useSelectedViewer();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  const hasEditorToggle = selectedViewer?.editors?.length > 1;
  if (!hasEditorToggle || disable3D) return null;

  const isThreed = effectiveViewerKey === "THREED";
  const buttonLabel = isThreed ? "2D" : "3D";

  function handleClick() {
    if (selectedViewerKey === "POINT_OF_VIEW") {
      // POV keeps its own editor mode until it migrates to
      // editorKeyByModule (see issue #296).
      togglePovViewerMode();
    } else {
      toggleModuleEditor();
    }
  }

  return (
    <Button
      variant="outlined"
      color="secondary"
      size="small"
      onClick={handleClick}
      sx={{
        gap: 1,
        borderRadius: "8px",
        border: (theme) => `1px solid ${theme.palette.secondary.main}`,
      }}
    >
      <ShortcutBadge>T</ShortcutBadge>
      <Typography variant="body2">{buttonLabel}</Typography>
    </Button>
  );
}
