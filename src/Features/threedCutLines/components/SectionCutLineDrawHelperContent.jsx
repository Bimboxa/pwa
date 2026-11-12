import { useDispatch, useSelector } from "react-redux";

import {
  setCutLineDrawAxis,
  setCutLineDrawOffset,
  toggleCutLineDrawSide,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import KeyChip from "Features/annotations/components/KeyChip";
import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";
import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";

// Shortcuts of the free trace (click polyline, useDrawingPointerHandlers).
const FREE_SHORTCUTS = [
  { key: "0-9", label: "Longueur du segment" },
  { key: "Entrée", label: "Terminer la ligne de coupe" },
  { key: "Esc", label: "Terminer / Quitter la ligne de coupe" },
];

// Shortcuts of the axis trace (onCutLineAxisKey, useDrawingPointerHandlers).
const AXIS_SHORTCUTS = [
  { key: "S", label: "Changer de côté" },
  { key: "0-9", label: "Distance depuis le bord" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Entrée", label: "Valider le trait" },
  { key: "Esc", label: "Effacer la saisie / Mode libre" },
];

const ROW_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 32,
};

// ---------------------------------------------------------------------------
// SectionCutLineDrawHelperContent — drawing-helper body of « Dessiner une
// ligne de coupe » (DRAW_CUT_LINE, Maillage module): the step hint, the
// trace mode — « Libre » (click polyline) or along a user axis X / Y / Z of
// the gizmo frame (CutLineAxisOverlayThreed: the chord of the hovered face
// parallel to the axis) — the « Décalage » guide (m from the reference
// corner), the side of that corner (S) and the shortcuts. Replaces the
// generic polyline helper body while the cut line is armed.
// ---------------------------------------------------------------------------

export default function SectionCutLineDrawHelperContent() {
  const dispatch = useDispatch();

  // strings

  const axisS = "Axe";
  const freeS = "Libre";
  const offsetS = "Décalage";
  const sideS = "Changer de côté";
  const freeHintS =
    "Cliquez les points de la ligne de coupe (plan, face, sommet, arête) — Entrée ou double-clic pour terminer : le trait est prolongé le long des faces";
  const axisHintS =
    "Survolez une face : le trait est parallèle à l'axe. Cliquez pour le valider";
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

  function handleToggleSide() {
    dispatch(toggleCutLineDrawSide());
  }

  // render

  return (
    <SectionTransformToolHelper
      hint={axis ? axisHintS : freeHintS}
      shortcuts={axis ? AXIS_SHORTCUTS : FREE_SHORTCUTS}
    >
      <Paper
        variant="outlined"
        sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: "background.paper" }}
      >
        <Box sx={ROW_SX}>
          <Typography variant="body2" color="text.secondary">
            {axisS}
          </Typography>
          <Tooltip title={inProgress ? axisBusyS : ""}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={axis ?? "FREE"}
              onChange={handleModeChange}
            >
              <ToggleButton
                value="FREE"
                sx={{ textTransform: "none", px: 1, py: 0.25 }}
              >
                {freeS}
              </ToggleButton>
              {["X", "Y", "Z"].map((key) => (
                <ToggleButton
                  key={key}
                  value={key}
                  disabled={inProgress}
                  sx={{
                    px: 1.25,
                    py: 0.25,
                    fontWeight: 700,
                    color: AXIS_COLORS[key],
                  }}
                >
                  {key}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Tooltip>
        </Box>
        <Box sx={{ ...ROW_SX, opacity: axis ? 1 : 0.5 }}>
          <FieldNumberCompact
            label={offsetS}
            value={offset}
            onChange={handleOffsetChange}
            unit="m"
            disabled={!axis}
          />
        </Box>
        <Box sx={{ ...ROW_SX, opacity: axis ? 1 : 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {sideS}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={handleToggleSide}
              disabled={!axis}
            >
              <SwapHorizIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <KeyChip disabled={!axis}>S</KeyChip>
          </Box>
        </Box>
      </Paper>
    </SectionTransformToolHelper>
  );
}
