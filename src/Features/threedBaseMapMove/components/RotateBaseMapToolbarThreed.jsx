import { useDispatch, useSelector } from "react-redux";

import { setRotateBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while the "Tourner" (rotate base map) mode is active —
// same swap pattern as MoveBaseMapToolbarThreed.
export default function RotateBaseMapToolbarThreed() {
  const dispatch = useDispatch();

  const carriedBaseMapId = useSelector(
    (s) => s.threedEditor.rotateBaseMapMode.carriedBaseMapId
  );

  // handlers

  function handleClose() {
    dispatch(setRotateBaseMapModeActive(false));
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
          Tourner
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {carriedBaseMapId
            ? "Tournez avec la souris, cliquez pour valider l'angle (Échap : annuler)"
            : "Cliquez le point de rotation sur le fond de plan à tourner"}
        </Typography>
        <Tooltip title="Quitter le mode rotation">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
