import { useDispatch, useSelector } from "react-redux";

import {
  clearExtrudeValueBuffer,
  setExtrudeModeActive,
  setExtrudeValueBuffer,
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
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

// Specialized bottom toolbar shown while extrude mode is active. Replaces
// BottomToolbarThreed (same swap pattern as MeshingToolbarThreed): the
// extrusion value takes the place of the tool buttons.
//
// The value shown is the typed buffer when there is one (digits captured from
// the keyboard by useExtrudePointerHandlers, no focus needed — same model as
// the 2D drawing constraint buffer), otherwise the live mouse-derived value.
// The field stays editable: what is typed in it feeds the same buffer.
export default function ExtrudeToolbarThreed() {
  const dispatch = useDispatch();

  const value = useSelector((s) => s.threedEditor.extrudeMode.value);
  const valueBuffer = useSelector(
    (s) => s.threedEditor.extrudeMode.valueBuffer
  );
  const targetAnnotationId = useSelector(
    (s) => s.threedEditor.extrudeMode.targetAnnotationId
  );

  const armed = !!targetAnnotationId;
  const typed = valueBuffer !== "";

  // strings

  const hintS = typed
    ? armed
      ? "Entrée ou clic pour valider (⌫ : effacer la saisie)"
      : "Valeur saisie — cliquez une face pour l'appliquer"
    : armed
      ? "Déplacez la souris ou tapez une valeur, clic pour valider (Échap : annuler)"
      : "Cliquez une face du dessus";

  // handlers

  function handleValueText(text) {
    dispatch(setExtrudeValueBuffer(text));
  }

  function handleClearBuffer() {
    dispatch(clearExtrudeValueBuffer());
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
          value={typed ? valueBuffer : value}
          onChangeText={handleValueText}
          unit="m"
        />

        {typed && (
          <Tooltip title="Effacer la valeur saisie (retour au réglage à la souris)">
            <IconButton size="small" onClick={handleClearBuffer}>
              <LockOutlinedIcon sx={{ fontSize: 18 }} color="primary" />
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
