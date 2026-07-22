import { useDispatch, useSelector } from "react-redux";

import {
  setExtrudeModeActive,
  setExtrudeTypedValue,
  setExtrudeValueLocked,
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
import MouseIcon from "@mui/icons-material/Mouse";

import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

// Specialized bottom toolbar shown while extrude mode is active. Replaces
// BottomToolbarThreed (same swap pattern as MeshingToolbarThreed): the
// extrusion value takes the place of the tool buttons.
export default function ExtrudeToolbarThreed() {
  const dispatch = useDispatch();

  const value = useSelector((s) => s.threedEditor.extrudeMode.value);
  const valueLocked = useSelector(
    (s) => s.threedEditor.extrudeMode.valueLocked
  );
  const targetAnnotationId = useSelector(
    (s) => s.threedEditor.extrudeMode.targetAnnotationId
  );

  const armed = !!targetAnnotationId;

  // strings

  const hintS = valueLocked
    ? "Valeur saisie — cliquez une face pour l'appliquer"
    : armed
      ? "Déplacez la souris, clic ou Entrée pour valider (Échap : annuler)"
      : "Cliquez une face du dessus";

  // handlers

  // Typing wins over the mouse until the user hands control back, otherwise
  // moving the cursor back onto the face would overwrite what was typed.
  function handleValueChange(newValue) {
    dispatch(setExtrudeTypedValue(newValue));
  }

  function handleUnlock() {
    dispatch(setExtrudeValueLocked(false));
  }

  function handleClose() {
    dispatch(setExtrudeModeActive(false));
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
          Extruder
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <FieldNumberCompact
          label="Extrusion"
          value={value}
          onChange={handleValueChange}
          unit="m"
        />

        {valueLocked && (
          <Tooltip title="Reprendre le réglage à la souris">
            <IconButton size="small" onClick={handleUnlock}>
              <MouseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          {hintS}
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Quitter le mode extrusion">
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
