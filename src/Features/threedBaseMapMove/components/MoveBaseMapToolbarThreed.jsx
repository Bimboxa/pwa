import { useDispatch, useSelector } from "react-redux";

import { setMoveBaseMapModeActive } from "Features/threedEditor/threedEditorSlice";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while the "Déplacer" (move base map) mode is active —
// same swap pattern as CoteToolbarThreed.
export default function MoveBaseMapToolbarThreed() {
  const dispatch = useDispatch();

  const carriedBaseMapId = useSelector(
    (s) => s.threedEditor.moveBaseMapMode.carriedBaseMapId
  );

  // handlers

  function handleClose() {
    dispatch(setMoveBaseMapModeActive(false));
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
          Déplacer
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {carriedBaseMapId
            ? "Cliquez le point de destination (Échap : annuler)"
            : "Cliquez un point du fond de plan à déplacer"}
        </Typography>
        <Tooltip title="Quitter le mode déplacement">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
