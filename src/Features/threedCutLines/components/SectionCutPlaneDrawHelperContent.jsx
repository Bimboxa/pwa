import { useSyncExternalStore } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setCutPlaneNearestOnly } from "Features/threedEditor/threedEditorSlice";

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

import { setCutPlaneBufferService } from "../services/computeCutPlaneCandidatesService";
import {
  getCutPlanePending,
  subscribeCutPlanePending,
} from "../services/cutPlaneStore";
import {
  buildCutPlaneBuffer,
  getCutPlaneCountPart,
  getCutPlaneMode,
  getCutPlaneValuePart,
} from "../utils/cutPlaneBuffer";

// Keys of onCutPlaneKey (useDrawingPointerHandlers).
const SHORTCUTS = [
  { key: "0-9", label: "Longueur de l'axe" },
  { key: "*N", label: "N plans, pas répété au-delà du 2e point" },
  { key: "/N", label: "N plans divisant l'axe" },
  { key: "↑ → ↓", label: "Verrouiller l'axe (← : libérer)" },
  { key: "Espace", label: "Créer les lignes de coupe" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Esc", label: "Annuler / Quitter" },
];

const ROW_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 32,
};

// ---------------------------------------------------------------------------
// SectionCutPlaneDrawHelperContent — drawing-helper body of « Plan de coupe »
// (DRAW_CUT_PLANE, Maillage module): the step hint, the typed buffer split
// in its fields (axis length, number of planes, « Répéter » `*` / « Diviser »
// `/`), the « contour le plus proche » option, the number of candidate cut
// lines waiting for Space, and the shortcuts.
// ---------------------------------------------------------------------------

export default function SectionCutPlaneDrawHelperContent() {
  const dispatch = useDispatch();

  // strings

  const firstHintS =
    "Cliquez le 1er point de l'axe : les plans de coupe lui sont perpendiculaires";
  const secondHintS =
    "Cliquez le 2e point : le plan de coupe passe par ce point";
  const validateHintS =
    "Espace pour créer les lignes de coupe — ou cliquez un autre 2e point";
  const noCandidateS =
    "Aucune annotation coupée — cliquez un autre 2e point (Esc pour annuler)";
  const lengthS = "Longueur";
  const countS = "Nombre de plans";
  const repeatS = "Répéter";
  const divideS = "Diviser";
  const nearestS = "Contour le plus proche uniquement";
  const candidatesS = "Lignes candidates";

  // data

  const buffer = useSelector((s) => s.threedEditor.cutPlaneDraw.buffer);
  const nearestOnly = useSelector(
    (s) => s.threedEditor.cutPlaneDraw.nearestOnly
  );
  const hasFirstPoint = useSelector(
    (s) => s.threedEditor.drawingMode.inProgressPolyline.length > 0
  );
  const pending = useSyncExternalStore(
    subscribeCutPlanePending,
    getCutPlanePending
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
    : hasFirstPoint
      ? secondHintS
      : firstHintS;

  // handlers

  function setBuffer(next) {
    setCutPlaneBufferService(dispatch, buildCutPlaneBuffer(next));
  }

  function handleLengthText(text) {
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
            label={lengthS}
            value={valueText}
            onChangeText={handleLengthText}
            unit="m"
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
            <ToggleButton
              value="REPEAT"
              sx={{ textTransform: "none", px: 1, py: 0.25 }}
            >
              {repeatS}
            </ToggleButton>
            <ToggleButton
              value="DIVIDE"
              sx={{ textTransform: "none", px: 1, py: 0.25 }}
            >
              {divideS}
            </ToggleButton>
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
