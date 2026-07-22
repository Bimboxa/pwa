import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while the template-driven cote (2-click) mode is active.
// Replaces the meshing / default toolbar (same swap pattern as
// MeshingToolbarThreed) so the Maillage module doesn't keep displaying cut
// tools that are inert while `meshingMode.active` is false.
//
// Closing clears the 2D drawing state — the same dispatch pair as the Esc
// handler of useDimensionPointerHandlers; useTemplateCoteDrawBridge then
// deactivates the 3D dimension mode.
export default function CoteToolbarThreed() {
  const dispatch = useDispatch();

  const startPoint = useSelector(
    (s) => s.threedEditor.dimensionMode.startPoint
  );

  // handlers

  function handleClose() {
    dispatch(setEnabledDrawingMode(null));
    dispatch(setNewAnnotation({}));
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>
          Cote
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {startPoint
            ? "2ᵉ point — cliquez sur un sommet ou une arête (Échap : annuler)"
            : "Cliquez sur un sommet ou une arête pour le 1ᵉʳ point"}
        </Typography>
        <Tooltip title="Quitter le mode cote">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
