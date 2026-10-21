import { useDispatch, useSelector } from "react-redux";

import { setAxesPlacementModeActive } from "Features/threedEditor/threedEditorSlice";

import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Bottom toolbar shown while the « Orienter le repère » mode is active —
// same swap pattern as RotateBaseMapToolbarThreed: the step hint (1/2
// origin, 2/2 X axis direction) and a close button.
export default function AxesPlacementToolbarThreed() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Orienter le repère";
  const originHintS =
    "1/2 — Cliquez le centre du repère (sommet, fond de plan ou point libre)";
  const directionHintS =
    "2/2 — Cliquez un point dans la direction de l'axe X (Échap : annuler)";
  const closeS = "Quitter l'outil";

  // data

  const originSet = useSelector(
    (s) => s.threedEditor.axesPlacementMode.originSet
  );

  // handlers

  function handleClose() {
    dispatch(setAxesPlacementModeActive(false));
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
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>
          {titleS}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", px: 0.5 }}>
          {originSet ? directionHintS : originHintS}
        </Typography>
        <Tooltip title={closeS}>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
