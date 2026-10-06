import { useDispatch, useSelector, useStore } from "react-redux";

import { Box, IconButton, Paper, Tooltip } from "@mui/material";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import { selectPdfEditorOpen } from "Features/pdfEditor/pdfEditorSlice";

import { WALK_MODE_TOGGLE_KEY, toggleWalkMode } from "../utils/walkModeToggle";

// Bottom-right "first person" toggle of the 3D editor, stacked above the 3D
// side of the 2D/3D switch: enters / exits the walk mode (same rule as the P shortcut, see
// walkModeToggle — the pointer lock is requested inside this click). The
// keycap badge mirrors the "T" badge of ButtonToggleThreedViewer.
export default function ButtonToggleWalkMode() {
  const dispatch = useDispatch();
  const store = useStore();

  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  const pdfEditorOpen = useSelector(selectPdfEditorOpen);

  // The PDF editor layer covers the 3D editor: no pointer lock under it.
  if (pdfEditorOpen) return null;

  // handlers

  function handleClick() {
    toggleWalkMode({ store, dispatch });
  }

  // render

  return (
    <Box sx={{ position: "relative" }}>
      <Paper elevation={3} sx={{ borderRadius: "10px" }}>
        <Tooltip title="Première personne">
          <IconButton
            size="small"
            color={walkActive ? "secondary" : "inherit"}
            onClick={handleClick}
          >
            <DirectionsWalkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
      {/* Opaque backing so the button doesn't show through the translucent
          ShortcutBadge background. */}
      <Box
        sx={{
          position: "absolute",
          top: -14,
          right: -6,
          transform: "scale(0.75)",
          transformOrigin: "top right",
          pointerEvents: "none",
          zIndex: 1,
          bgcolor: "background.paper",
          borderRadius: "6px",
          lineHeight: 0,
        }}
      >
        <ShortcutBadge>{WALK_MODE_TOGGLE_KEY.toUpperCase()}</ShortcutBadge>
      </Box>
    </Box>
  );
}
