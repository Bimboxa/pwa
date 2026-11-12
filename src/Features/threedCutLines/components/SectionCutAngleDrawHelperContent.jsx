import { useSyncExternalStore } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setCutPlaneAngleAxis,
  setCutPlaneBuffer,
  setCutPlaneNearestOnly,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  Paper,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";
import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";

import {
  getCutAngleRef,
  getCutPlanePending,
  subscribeCutPlanePending,
} from "../services/cutPlaneStore";
import {
  buildCutPlaneBuffer,
  getCutPlaneCountPart,
  getCutPlaneMode,
  getCutPlaneValuePart,
} from "../utils/cutPlaneBuffer";

// Keys of onCutAngleKey (useDrawingPointerHandlers).
const SHORTCUTS = [
  { key: "0-9", label: "Angle (°)" },
  { key: "*N", label: "N demi-plans, angle répété" },
  { key: "/N", label: "N demi-plans divisant l'angle" },
  { key: "X Y Z", label: "Axe de rotation" },
  { key: "↑ → ↓", label: "Verrouiller l'axe (← : libérer)" },
  { key: "Espace", label: "Créer les lignes de coupe" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Esc", label: "Annuler / Quitter" },
];

const AXES = ["X", "Y", "Z"];

const ROW_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 32,
};

const TOGGLE_SX = { textTransform: "none", px: 1, py: 0.25 };

// ---------------------------------------------------------------------------
// SectionCutAngleDrawHelperContent — drawing-helper body of « Coupe par
// angle » (DRAW_CUT_ANGLE, Maillage module): the step hint, the typed buffer
// split in its fields (angle, number of half-planes, « Répéter » `*` /
// « Diviser » `/`), the rotation axis, the « contour le plus proche »
// option, the number of candidate cut lines waiting for Space, and the
// shortcuts.
// ---------------------------------------------------------------------------

export default function SectionCutAngleDrawHelperContent() {
  const dispatch = useDispatch();

  // strings

  const firstHintS =
    "Cliquez le pivot : l'axe de rotation des demi-plans de coupe passe par ce point";
  const secondHintS = "Cliquez le 2e point : la direction de référence (0°)";
  const thirdHintS =
    "Cliquez le 3e point pour fixer l'angle — ou saisissez-le au clavier";
  const validateHintS =
    "Espace pour créer les lignes de coupe — ou cliquez un autre angle";
  const noCandidateS =
    "Aucune annotation coupée — cliquez un autre angle (Esc pour annuler)";
  const angleS = "Angle";
  const countS = "Nombre de demi-plans";
  const repeatS = "Répéter";
  const divideS = "Diviser";
  const axisS = "Axe de rotation";
  const nearestS = "Contour le plus proche uniquement";
  const candidatesS = "Lignes candidates";

  // data

  const buffer = useSelector((s) => s.threedEditor.cutPlaneDraw.buffer);
  const nearestOnly = useSelector(
    (s) => s.threedEditor.cutPlaneDraw.nearestOnly
  );
  const angleAxis = useSelector((s) => s.threedEditor.cutPlaneDraw.angleAxis);
  const hasFirstPoint = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline.length > 0
  );
  const pending = useSyncExternalStore(
    subscribeCutPlanePending,
    getCutPlanePending
  );
  const angleRef = useSyncExternalStore(
    subscribeCutPlanePending,
    getCutAngleRef
  );

  // helpers

  const valueText = getCutPlaneValuePart(buffer);
  const countText = getCutPlaneCountPart(buffer);
  const mode = getCutPlaneMode(buffer);
  const candidatesCount = pending?.candidates?.length ?? 0;
  const hint = pending
    ? candidatesCount
      ? validateHintS
      : noCandidateS
    : !hasFirstPoint
      ? firstHintS
      : angleRef
        ? thirdHintS
        : secondHintS;

  // handlers

  function setBuffer(next) {
    dispatch(setCutPlaneBuffer(buildCutPlaneBuffer(next)));
  }

  function handleAngleText(text) {
    setBuffer({ valueText: text, countText, mode });
  }

  function handleCountText(text) {
    setBuffer({ valueText, countText: text, mode });
  }

  function handleModeChange(e, value) {
    if (!value) return;
    setBuffer({ valueText, countText, mode: value });
    // The 3D key handler ignores a focused control's keys.
    e.currentTarget?.blur?.();
  }

  function handleAxisChange(e, value) {
    if (!value) return;
    dispatch(setCutPlaneAngleAxis(value));
    e.currentTarget?.blur?.();
  }

  function handleNearestChange(e) {
    dispatch(setCutPlaneNearestOnly(e.target.checked));
    e.target.blur();
  }

  // Enter in a field gives the keyboard back to the 3D view (Space then
  // validates there).
  function handleKeyDownCapture(e) {
    if (e.target?.tagName !== "INPUT") return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  // render

  return (
    <SectionTransformToolHelper hint={hint} shortcuts={SHORTCUTS}>
      <Paper
        variant="outlined"
        onKeyDownCapture={handleKeyDownCapture}
        sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: "background.paper" }}
      >
        <Box sx={ROW_SX}>
          <FieldNumberCompact
            label={angleS}
            value={valueText}
            onChangeText={handleAngleText}
            unit="°"
          />
        </Box>
        <Box sx={ROW_SX}>
          <FieldNumberCompact
            label={countS}
            value={countText}
            onChangeText={handleCountText}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={handleModeChange}
          >
            <ToggleButton value="REPEAT" sx={TOGGLE_SX}>
              {repeatS}
            </ToggleButton>
            <ToggleButton value="DIVIDE" sx={TOGGLE_SX}>
              {divideS}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={ROW_SX}>
          <Typography variant="body2" color="text.secondary">
            {axisS}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={angleAxis}
            onChange={handleAxisChange}
          >
            {AXES.map((axis) => (
              <ToggleButton key={axis} value={axis} sx={TOGGLE_SX}>
                {axis}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box sx={ROW_SX}>
          <Typography variant="body2" color="text.secondary">
            {nearestS}
          </Typography>
          <Switch
            size="small"
            checked={nearestOnly}
            onChange={handleNearestChange}
          />
        </Box>
        {pending && (
          <Box sx={ROW_SX}>
            <Typography variant="body2" color="text.secondary">
              {candidatesS}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, pr: 1 }}>
              {candidatesCount}
            </Typography>
          </Box>
        )}
      </Paper>
    </SectionTransformToolHelper>
  );
}
