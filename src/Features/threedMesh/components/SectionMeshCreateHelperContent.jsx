import { useDispatch, useSelector } from "react-redux";

import {
  clearMeshingSurfaceBuffer,
  setMeshingSurfaceBuffer,
} from "Features/threedEditor/threedEditorSlice";

import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";

import parseRectBuffer from "Features/mapEditor/utils/parseRectBuffer";

import formatSurfaceM2 from "../utils/formatSurfaceM2";

// Shortcuts of the CREATE tool (useMeshingPointerHandlers).
const MESH_CREATE_SHORTCUTS = [
  { key: "S", label: "Saisir une surface" },
  { key: "0-9", label: "Valeur de la surface (m²)" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Entrée", label: "Valider la surface" },
  { key: "Esc", label: "Effacer la surface / Quitter" },
];

// ---------------------------------------------------------------------------
// SectionMeshCreateHelperContent — drawing-helper body of « Ajouter une
// maille » (Maillage module, CREATE tool of the meshing mode): the step
// hint, the target surface field and the shortcuts. The field mirrors the
// keyboard buffer (meshingMode.surfaceBuffer — S arms the input, the digits
// typed anywhere feed it) and writes the same buffer back.
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

  // helpers

  const surface = parseRectBuffer(surfaceBuffer);
  const hasSurface = Number.isFinite(surface) && surface > 0;

  // strings

  const hintS = surfaceInputArmed
    ? "Saisissez la surface de la maille (m²), puis Entrée"
    : hasSurface
      ? `Cliquez sur une face : maille de ${formatSurfaceM2(surface, 2)} calée dans le coin le plus proche (bords, lignes de coupe, mailles existantes)`
      : "Cliquez sur une face pour créer une maille. Tapez S pour fixer sa surface";

  // handlers

  function handleSurfaceText(text) {
    dispatch(
      setMeshingSurfaceBuffer(text.replace(",", ".").replace(/[^0-9.]/g, ""))
    );
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
      }}
      shortcuts={MESH_CREATE_SHORTCUTS}
    />
  );
}
