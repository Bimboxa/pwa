import { useDispatch, useSelector } from "react-redux";

import {
  setRotateBaseMapModeActive,
  setRotateAngleBuffer,
} from "Features/threedEditor/threedEditorSlice";

import {
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import applyRotateBaseMapPose, {
  parseRotateAngleBuffer,
} from "../utils/applyRotateBaseMapPose";
import { getRotateGrab } from "../services/rotateBaseMapSessionStore";

// Bottom toolbar shown while the "Tourner" (rotate base map) mode is active —
// same swap pattern as MoveBaseMapToolbarThreed. In the rotation phase (3/3)
// an angle field mirrors the keyboard buffer: digits typed anywhere feed it
// (no focus needed, same model as the extrude value buffer), and editing the
// field feeds the same buffer back.
export default function RotateBaseMapToolbarThreed() {
  const dispatch = useDispatch();

  const carriedBaseMapId = useSelector(
    (s) => s.threedEditor.rotateBaseMapMode.carriedBaseMapId
  );
  const referenceSet = useSelector(
    (s) => s.threedEditor.rotateBaseMapMode.referenceSet
  );
  const angleBuffer = useSelector(
    (s) => s.threedEditor.rotateBaseMapMode.angleBuffer
  );

  // handlers

  function handleAngleText(text) {
    dispatch(setRotateAngleBuffer(text));
    const grab = getRotateGrab();
    if (!grab || grab.refBearing == null) return;
    grab.angleBuffer = text;
    const phi = parseRotateAngleBuffer(text);
    if (phi != null) applyRotateBaseMapPose(getActiveThreedEditor(), grab, phi);
  }

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
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography sx={{ fontSize: 13, fontWeight: 500, px: 0.5 }}>
          Tourner
        </Typography>

        {referenceSet && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <FieldNumberCompact
              label="Angle"
              value={angleBuffer}
              onChangeText={handleAngleText}
              unit="°"
            />
          </>
        )}

        <Typography sx={{ fontSize: 12, color: "text.secondary", px: 0.5 }}>
          {!carriedBaseMapId
            ? "1/3 — Cliquez le centre de rotation sur le fond de plan à tourner"
            : !referenceSet
              ? "2/3 — Cliquez un point pour fixer l'axe de référence"
              : "3/3 — Tournez ou tapez l'angle, clic ou Entrée pour valider (Échap : annuler)"}
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
