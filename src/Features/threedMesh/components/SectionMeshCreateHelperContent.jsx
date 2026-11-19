import { useDispatch, useSelector } from "react-redux";

import {
  clearMeshingSurfaceBuffer,
  setMeshingCreateNumber,
  setMeshingMergeAdjacentFaces,
  setMeshingSurfaceBuffer,
} from "Features/threedEditor/threedEditorSlice";

import { FormControlLabel, Paper, Switch, Typography } from "@mui/material";

import KeyChip from "Features/annotations/components/KeyChip";

import FieldNumberCompact from "./FieldNumberCompact";
import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";

import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";

import useNextMesh3dNumber from "../hooks/useNextMesh3dNumber";
import formatSurfaceM2 from "../utils/formatSurfaceM2";

const CARD_SX = {
  px: 0.5,
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
};

// Shortcuts of the CREATE tool (useMeshingPointerHandlers). The keys of the
// options (S surface, F merge switch, N number) sit at the end of their own
// line instead.
const MESH_CREATE_SHORTCUTS = [
  { key: "0-9", label: "Valeur de la surface (m²)" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Entrée", label: "Valider la surface" },
  { key: "Esc", label: "Effacer la surface / Quitter" },
];

// ---------------------------------------------------------------------------
// SectionMeshCreateHelperContent — drawing-helper body of « Ajouter une
// maille » (Maillage module, CREATE tool of the meshing mode): the step
// hint, the target surface field, the « Fusionner les faces adjacentes »
// switch, the « Numéro de la maille » field and the shortcuts. The surface
// field mirrors the keyboard buffer (meshingMode.surfaceBuffer — S arms the
// input, the digits typed anywhere feed it) and writes the same buffer back.
// The switch (meshingMode.mergeAdjacentFaces) does not apply to a maille of
// a typed surface. The number field shows the number of the next created
// maille: the typed one (meshingMode.createNumber, +1 after every click),
// else the next free number of the scope. N arms its keyboard input
// (meshingMode.numberInputArmed, like S for the surface): the field is
// highlighted and shows the digits as they are typed (numberBuffer).
// ---------------------------------------------------------------------------

export default function SectionMeshCreateHelperContent() {
  const dispatch = useDispatch();

  // data

  const surfaceBuffer = useSelector(
    (s) => s.threedEditor.meshingMode.surfaceBuffer
  );
  const surfaceInputArmed = useSelector(
    (s) => s.threedEditor.meshingMode.surfaceInputArmed
  );

  const mergeAdjacentFaces = useSelector(
    (s) => s.threedEditor.meshingMode.mergeAdjacentFaces
  );
  const createNumber = useSelector(
    (s) => s.threedEditor.meshingMode.createNumber
  );
  const numberInputArmed = useSelector(
    (s) => s.threedEditor.meshingMode.numberInputArmed
  );
  const numberBuffer = useSelector(
    (s) => s.threedEditor.meshingMode.numberBuffer
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const nextNumber = useNextMesh3dNumber({ projectId, scopeId });

  // helpers

  const surface = parseRectBuffer(surfaceBuffer);
  const hasSurface = Number.isFinite(surface) && surface > 0;

  // strings

  const mergeS = "Fusionner les faces adjacentes";
  const numberS = "Numéro de la maille";

  const hintS = numberInputArmed
    ? "Saisissez le numéro de la maille, puis Entrée"
    : surfaceInputArmed
      ? "Saisissez la surface de la maille (m²), puis Entrée"
      : hasSurface
        ? `Cliquez sur une face : maille de ${formatSurfaceM2(surface, 2)} calée dans le coin le plus proche (bords, lignes de coupe, mailles existantes)`
        : "Cliquez sur une face pour créer une maille";

  // handlers

  function handleSurfaceText(text) {
    dispatch(
      setMeshingSurfaceBuffer(text.replace(",", ".").replace(/[^0-9.]/g, ""))
    );
  }

  function handleNumberText(text) {
    const number = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (number >= 1) dispatch(setMeshingCreateNumber(number));
  }

  function handleNumberKeyDown(e) {
    if (e.key === "Enter") e.target.blur?.();
  }

  // render

  return (
    <SectionTransformToolHelper
      hint={hintS}
      field={{
        label: "Surface",
        unit: "m²",
        value: surfaceBuffer,
        onChangeText: handleSurfaceText,
        onClear: surfaceBuffer
          ? () => dispatch(clearMeshingSurfaceBuffer())
          : undefined,
        clearTitle: "Effacer la surface (maille = pièce entière)",
        shortcutKey: "S",
      }}
      shortcuts={MESH_CREATE_SHORTCUTS}
    >
      <Paper elevation={0} sx={{ ...CARD_SX, pl: 1 }}>
        <FormControlLabel
          sx={{ ml: 0 }}
          disabled={hasSurface}
          control={
            <Switch
              size="small"
              checked={mergeAdjacentFaces}
              onChange={(e) =>
                dispatch(setMeshingMergeAdjacentFaces(e.target.checked))
              }
            />
          }
          label={
            <Typography variant="body2" sx={{ ml: 0.5 }}>
              {mergeS}
            </Typography>
          }
        />
        <KeyChip sx={{ mr: 0.5 }}>F</KeyChip>
      </Paper>
      <Paper
        elevation={0}
        sx={{
          ...CARD_SX,
          ...(numberInputArmed && {
            borderColor: "primary.main",
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
          }),
        }}
        onKeyDown={handleNumberKeyDown}
      >
        <FieldNumberCompact
          label={numberS}
          value={numberInputArmed ? numberBuffer : (createNumber ?? nextNumber)}
          onChangeText={handleNumberText}
        />
        <KeyChip sx={{ mr: 0.5 }}>N</KeyChip>
      </Paper>
    </SectionTransformToolHelper>
  );
}
