import { useDispatch, useSelector } from "react-redux";

import { setMoveAnnotationModeActive } from "Features/threedEditor/threedEditorSlice";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while the "Déplacer" (move annotation) mode is active
// — same swap pattern as MoveBaseMapToolbarThreed.
export default function MoveAnnotationToolbarThreed() {
  const dispatch = useDispatch();

  const carriedCount = useSelector(
    (s) => s.threedEditor.moveAnnotationMode.carriedAnnotationIds.length
  );

  // handlers

  function handleClose() {
    dispatch(setMoveAnnotationModeActive(false));
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
          {carriedCount > 0
            ? "Cliquez le point de destination (Échap : annuler)"
            : "Cliquez un point de l'annotation à déplacer"}
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
