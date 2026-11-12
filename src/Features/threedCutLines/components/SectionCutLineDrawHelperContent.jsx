import { useDispatch, useSelector } from "react-redux";

import { clearConstraintBuffer } from "Features/mapEditor/mapEditorSlice";
import {
  setCutLineDrawAxis,
  setCutLineDrawOffset,
  setCutLineDrawStopAtFirst,
  toggleCutLineDrawSide,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  IconButton,
  Paper,
  Switch,
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
  { key: "X / Y / Z", label: "Trait parallèle à l'axe" },
  { key: "0-9", label: "Longueur du segment" },
  { key: "Entrée", label: "Terminer la ligne de coupe" },
  { key: "Esc", label: "Terminer / Quitter la ligne de coupe" },
];

// Shortcuts of the axis trace (onCutLineAxisKey, useDrawingPointerHandlers).
const AXIS_SHORTCUTS = [
  { key: "X / Y / Z", label: "Changer d'axe (2e appui : mode libre)" },
  { key: "S", label: "Changer de côté" },
  { key: "0-9", label: "Distance depuis le bord / trait voisin" },
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
// parallel to the axis) — the « Décalage » guide (m from the reference: the
// edge of the face or the neighbouring cut line), which shows the distance
// being typed in the 3D view while there is one (`constraintBuffer`, it
// locks the line), the side of the reference edge (S), the « Arrêter à la
// première arête / ligne » switch (a « Stop » on the first point of each
// extension, commitDrawnCutLineService) and the shortcuts.
// Replaces the generic polyline helper body while the cut line is armed.
// ---------------------------------------------------------------------------

export default function SectionCutLineDrawHelperContent() {
  const dispatch = useDispatch();

  // strings

  const axisS = "Axe";
  const freeS = "Libre";
  const offsetS = "Décalage";
  const sideS = "Changer de côté";
  const stopAtFirstS = "Arrêter à la première arête / ligne";
  const freeHintS =
    "Cliquez les points de la ligne de coupe (plan, face, sommet, arête) — Entrée ou double-clic pour terminer : le trait est prolongé le long des faces";
  const axisHintS =
    "Survolez une face : le trait est parallèle à l'axe. Cliquez pour le valider";
  const axisBusyS = "Terminez le trait en cours avant de changer de mode";

  // data

  const axis = useSelector((s) => s.threedEditor.cutLineDraw.axis);
  const offset = useSelector((s) => s.threedEditor.cutLineDraw.offset);
  const stopAtFirst = useSelector((s) =>
    Boolean(s.threedEditor.cutLineDraw.stopAtFirst)
  );
  const inProgress = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline.length > 0
  );
  // Distance being typed in the 3D view (axis mode only: in free mode the
  // buffer is the segment length).
  const typedBuffer = useSelector((s) =>
    s.threedEditor.cutLineDraw.axis ? s.mapEditor.constraintBuffer : ""
  );

  // helpers

  const isTyping = Boolean(typedBuffer);

  // handlers

  function handleModeChange(_e, value) {
    if (!value) return;
    dispatch(setCutLineDrawAxis(value === "FREE" ? null : value));
  }

  function handleOffsetChange(v) {
    dispatch(setCutLineDrawOffset(v));
  }

  // Editing the field takes over from a distance typed in the 3D view.
  function handleOffsetTextChange() {
    if (isTyping) dispatch(clearConstraintBuffer());
  }

  function handleToggleSide() {
    dispatch(toggleCutLineDrawSide());
  }

  function handleStopAtFirstChange(e) {
    dispatch(setCutLineDrawStopAtFirst(e.target.checked));
  }

  // The 3D key handler ignores the keys typed in an input: the tool's
  // letters still act from the « Décalage » field (instead of landing in it)
  // and Enter gives the keyboard back to the 3D view.
  function handleKeyDownCapture(e) {
    if (e.target?.tagName !== "INPUT") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
      return;
    }
    const letter = e.key.length === 1 ? e.key.toUpperCase() : "";
    if (letter === "S") {
      e.preventDefault();
      if (!e.repeat) dispatch(toggleCutLineDrawSide());
    } else if (["X", "Y", "Z"].includes(letter)) {
      e.preventDefault();
      if (e.repeat || inProgress) return;
      dispatch(clearConstraintBuffer());
      dispatch(setCutLineDrawAxis(axis === letter ? null : letter));
    }
  }

  // render

  return (
    <SectionTransformToolHelper
      hint={axis ? axisHintS : freeHintS}
      shortcuts={axis ? AXIS_SHORTCUTS : FREE_SHORTCUTS}
    >
      <Paper
        variant="outlined"
        onKeyDownCapture={handleKeyDownCapture}
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
        <Box
          sx={{
            ...ROW_SX,
            opacity: axis ? 1 : 0.5,
            // A typed distance locks the line: shown as such.
            ...(isTyping && {
              "& .MuiInputBase-input": {
                color: "secondary.main",
                fontWeight: 700,
              },
            }),
          }}
        >
          <FieldNumberCompact
            label={offsetS}
            value={isTyping ? typedBuffer : offset}
            onChange={handleOffsetChange}
            onChangeText={handleOffsetTextChange}
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
        <Box sx={ROW_SX}>
          <Typography variant="body2" color="text.secondary">
            {stopAtFirstS}
          </Typography>
          <Switch
            size="small"
            checked={stopAtFirst}
            onChange={handleStopAtFirstChange}
          />
        </Box>
      </Paper>
    </SectionTransformToolHelper>
  );
}
