import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  IconButton,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";
import {
  setCutLineDrawAxis,
  setCutLineDrawOffset,
} from "Features/threedEditor/threedEditorSlice";
import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

// Bottom toolbar shown while a cut line is armed in the 3D editor
// (DRAW_CUT_LINE, Maillage module): the trace mode — « Libre » (click
// polyline) or along a user axis X / Y / Z of the gizmo frame
// (CutLineAxisOverlayThreed: the chord of the hovered face parallel to the
// axis, the meshing « Découpe » logic in the frame's orientation) — the
// « Décalage » guide (m from the reference corner) and the key hints.
// Replaces the meshing toolbar (same swap as CoteToolbarThreed) so the
// Maillage module doesn't keep showing cut tools inert while the drawing
// mode owns the pointer.
export default function CutLineToolbarThreed() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Ligne de coupe";
  const freeS = "Libre";
  const offsetS = "Décalage";
  const freeHintS =
    "Cliquez les points (Entrée : terminer, le trait est prolongé le long des faces)";
  const axisHintS =
    "Survolez une face : trait parallèle à l'axe (S : changer de côté, 0-9 : distance, Échap : libre)";
  const axisBusyS = "Terminez le trait en cours avant de changer de mode";

  // data

  const axis = useSelector((s) => s.threedEditor.cutLineDraw.axis);
  const offset = useSelector((s) => s.threedEditor.cutLineDraw.offset);
  const inProgress = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline.length > 0
  );

  // handlers

  function handleModeChange(_e, value) {
    if (!value) return;
    dispatch(setCutLineDrawAxis(value === "FREE" ? null : value));
  }

  function handleOffsetChange(v) {
    dispatch(setCutLineDrawOffset(v));
  }

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
          {titleS}
        </Typography>
        <Tooltip title={inProgress ? axisBusyS : ""}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={axis ?? "FREE"}
            onChange={handleModeChange}
          >
            <ToggleButton value="FREE" sx={{ textTransform: "none", px: 1 }}>
              {freeS}
            </ToggleButton>
            {["X", "Y", "Z"].map((key) => (
              <ToggleButton
                key={key}
                value={key}
                disabled={inProgress}
                sx={{ px: 1.25, fontWeight: 700, color: AXIS_COLORS[key] }}
              >
                {key}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Tooltip>
        <Box sx={{ opacity: axis ? 1 : 0.5 }}>
          <FieldNumberCompact
            label={offsetS}
            value={offset}
            onChange={handleOffsetChange}
            unit="m"
            disabled={!axis}
          />
        </Box>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {axis ? axisHintS : freeHintS}
        </Typography>
        <Tooltip title="Quitter la ligne de coupe">
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
