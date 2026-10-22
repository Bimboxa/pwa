import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { selectIsTemplateCoteDrawActive } from "Features/threedDrawing/utils/templateCoteDrawSelectors";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while a cote is armed in the 3D editor (COTE template
// row, or the "Dessin" tool on its cote type — the cote rides the 3D drawing
// mode, see useDrawingPointerHandlers). Replaces the meshing / default
// toolbar (same swap pattern as MeshingToolbarThreed) so the Maillage module
// doesn't keep displaying cut tools that are inert while
// `meshingMode.active` is false.
//
// Closing clears the 2D drawing state — the same dispatch pair as the Esc
// handler of useDrawingPointerHandlers; useTemplateFaceDrawBridge then
// deactivates the 3D drawing mode.
export default function CoteToolbarThreed() {
  const dispatch = useDispatch();

  const hasFirstPoint = useSelector(
    (s) =>
      selectIsTemplateCoteDrawActive(s) &&
      s.threedEditor.drawingMode.inProgressPolyline.length > 0
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
          {hasFirstPoint
            ? "2ᵉ point — cliquez n'importe où (0-9 : longueur, Échap : annuler)"
            : "Cliquez le 1ᵉʳ point de la cote (plan, face, sommet, arête ou axe)"}
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
