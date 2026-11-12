import { useDispatch, useSelector } from "react-redux";

import { setMeshingNumberingNext } from "Features/threedEditor/threedEditorSlice";

import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";

// Shortcuts of the NUMBER tool (useMeshingPointerHandlers).
const MESH_NUMBER_SHORTCUTS = [{ key: "Esc", label: "Quitter" }];

// ---------------------------------------------------------------------------
// SectionMeshNumberHelperContent — drawing-helper body of « Numéroter »
// (Maillage module, NUMBER tool of the meshing mode): the step hint and the
// « Démarrage » field — the number given to the next clicked maille
// (meshingMode.numberingNext, +1 after every click).
// ---------------------------------------------------------------------------

export default function SectionMeshNumberHelperContent() {
  const dispatch = useDispatch();

  // data

  const numberingNext = useSelector(
    (s) => s.threedEditor.meshingMode.numberingNext
  );

  // strings

  const hintS = `Cliquez sur une maille pour lui attribuer le numéro ${numberingNext}`;

  // handlers

  function handleNumberText(text) {
    const number = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (number >= 1) dispatch(setMeshingNumberingNext(number));
  }

  // render

  return (
    <SectionTransformToolHelper
      hint={hintS}
      field={{
        label: "Démarrage",
        value: numberingNext,
        onChangeText: handleNumberText,
      }}
      shortcuts={MESH_NUMBER_SHORTCUTS}
    />
  );
}
