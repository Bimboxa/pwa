import { useDispatch, useSelector } from "react-redux";

import {
  clearExtrudeValueBuffer,
  clearVertexOffsetValueBuffer,
  setExtrudeValueBuffer,
  setRotateAnnotationAngleBuffer,
  setVertexOffsetValueBuffer,
} from "Features/threedEditor/threedEditorSlice";

import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";

import {
  getMoveToolHint,
  getRotateToolHint,
  MOVE_TOOL_SHORTCUTS,
  ROTATE_TOOL_SHORTCUTS,
} from "Features/annotationTransform/constants/transformToolStrings";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { parseRotateAngleBuffer } from "Features/threedBaseMapMove/utils/applyRotateBaseMapPose";
import applyRotateAnnotationsPose from "Features/threedAnnotationMove/utils/applyRotateAnnotationsPose";
import { getRotateAnnotationGrab } from "Features/threedAnnotationMove/services/rotateAnnotationSessionStore";
import getVertexOffsetFieldLabel from "Features/threedVertexOffset/utils/getVertexOffsetFieldLabel";

// Shortcuts of the 3D « Extruder » (useExtrudePointerHandlers).
const EXTRUDE_SHORTCUTS = [
  { key: "0-9", label: "Saisir la valeur" },
  { key: "Entrée", label: "Valider l'extrusion" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Esc", label: "Annuler / Quitter" },
];

// Shortcuts of the vertex offset mode (useVertexOffsetPointerHandlers).
const VERTEX_OFFSET_SHORTCUTS = [
  { key: "0-9", label: "Saisir le décalage" },
  { key: "Entrée", label: "Valider le déplacement" },
  { key: "⌫", label: "Effacer la saisie" },
  { key: "Esc", label: "Annuler / Quitter" },
];

// Shortcuts of the 3D « Isoler une face » (useIsolateFacePointerHandlers).
const ISOLATE_FACE_SHORTCUTS = [{ key: "Esc", label: "Quitter" }];

// Shortcuts of the 3D « Fusionner des faces » (useMergeFacesPointerHandlers).
const MERGE_FACES_SHORTCUTS = [{ key: "Esc", label: "Quitter" }];

// ---------------------------------------------------------------------------
// SectionThreedToolHelperContent — drawing-helper body of the threedEditor
// tools armed from « Outils de dessin » in the Dessin module's 3D editor
// (`tool` = selectActiveThreedTool). The numeric fields mirror the keyboard
// buffers: digits typed anywhere feed them (no focus needed), and editing a
// field feeds the same buffer back.
// ---------------------------------------------------------------------------

export default function SectionThreedToolHelperContent({ tool }) {
  const dispatch = useDispatch();

  // data

  const extrudeValue = useSelector((s) => s.threedEditor.extrudeMode.value);
  const extrudeValueBuffer = useSelector(
    (s) => s.threedEditor.extrudeMode.valueBuffer
  );
  const mergeFacesSeed = useSelector((s) => s.threedEditor.mergeFacesMode.seed);
  const extrudeTargetAnnotationId = useSelector(
    (s) => s.threedEditor.extrudeMode.targetAnnotationId
  );
  const moveCarriedCount = useSelector(
    (s) => s.threedEditor.moveAnnotationMode.carriedAnnotationIds.length
  );
  const vertexOffsetField = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.armedField
  );
  const vertexOffsetValue = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.value
  );
  const vertexOffsetValueBuffer = useSelector(
    (s) => s.threedEditor.vertexOffsetMode.valueBuffer
  );
  const rotateCarriedCount = useSelector(
    (s) => s.threedEditor.rotateAnnotationMode.carriedAnnotationIds.length
  );
  const referenceSet = useSelector(
    (s) => s.threedEditor.rotateAnnotationMode.referenceSet
  );
  const angleBuffer = useSelector(
    (s) => s.threedEditor.rotateAnnotationMode.angleBuffer
  );

  // helpers

  const extrudeArmed = Boolean(extrudeTargetAnnotationId);
  const extrudeTyped = extrudeValueBuffer !== "";
  const vertexArmed = Boolean(vertexOffsetField);
  const vertexTyped = vertexOffsetValueBuffer !== "";

  // strings

  const extrudeHintS = extrudeTyped
    ? extrudeArmed
      ? "Entrée ou clic pour valider"
      : "Valeur saisie — cliquez une face pour l'appliquer"
    : extrudeArmed
      ? "Déplacez la souris ou tapez une valeur, clic pour valider"
      : "Cliquez une face du dessus";

  const vertexOffsetHintS = vertexArmed
    ? vertexTyped
      ? "Entrée ou clic pour valider"
      : "Déplacez la souris ou tapez le décalage, clic pour valider"
    : "Cliquez un sommet de la face à décaler";

  // handlers

  function handleExtrudeText(text) {
    dispatch(setExtrudeValueBuffer(text));
  }

  function handleVertexOffsetText(text) {
    dispatch(setVertexOffsetValueBuffer(text));
  }

  function handleAngleText(text) {
    dispatch(setRotateAnnotationAngleBuffer(text));
    const grab = getRotateAnnotationGrab();
    if (!grab || grab.refBearing == null) return;
    grab.angleBuffer = text;
    const phi = parseRotateAngleBuffer(text);
    if (phi != null)
      applyRotateAnnotationsPose(getActiveThreedEditor(), grab, phi);
  }

  // render

  if (tool === "EXTRUDE") {
    return (
      <SectionTransformToolHelper
        hint={extrudeHintS}
        field={{
          label: "Extrusion",
          unit: "m",
          value: extrudeTyped ? extrudeValueBuffer : extrudeValue,
          onChangeText: handleExtrudeText,
          onClear: extrudeTyped
            ? () => dispatch(clearExtrudeValueBuffer())
            : undefined,
          clearTitle:
            "Effacer la valeur saisie (retour au réglage à la souris)",
        }}
        shortcuts={EXTRUDE_SHORTCUTS}
      />
    );
  }

  if (tool === "VERTEX_OFFSET") {
    return (
      <SectionTransformToolHelper
        hint={vertexOffsetHintS}
        field={
          vertexArmed
            ? {
                label: getVertexOffsetFieldLabel(vertexOffsetField),
                unit: "m",
                value: vertexTyped
                  ? vertexOffsetValueBuffer
                  : vertexOffsetValue,
                onChangeText: handleVertexOffsetText,
                onClear: vertexTyped
                  ? () => dispatch(clearVertexOffsetValueBuffer())
                  : undefined,
                clearTitle:
                  "Effacer la valeur saisie (retour au réglage à la souris)",
              }
            : null
        }
        shortcuts={VERTEX_OFFSET_SHORTCUTS}
      />
    );
  }

  if (tool === "ISOLATE_FACE") {
    return (
      <SectionTransformToolHelper
        hint="Cliquez une face d'un mur ou d'une bande pour isoler son segment"
        shortcuts={ISOLATE_FACE_SHORTCUTS}
      />
    );
  }

  if (tool === "MERGE_FACES") {
    return (
      <SectionTransformToolHelper
        hint={
          mergeFacesSeed
            ? "Cliquez une face coplanaire d'une annotation voisine pour la fusionner"
            : "Cliquez la face de départ, puis les faces coplanaires des annotations voisines"
        }
        shortcuts={MERGE_FACES_SHORTCUTS}
      />
    );
  }

  if (tool === "MOVE_ANNOTATION") {
    return (
      <SectionTransformToolHelper
        hint={getMoveToolHint({ carriedCount: moveCarriedCount })}
        shortcuts={MOVE_TOOL_SHORTCUTS}
      />
    );
  }

  return (
    <SectionTransformToolHelper
      hint={getRotateToolHint({
        carriedCount: rotateCarriedCount,
        referenceSet,
      })}
      field={
        referenceSet
          ? {
              label: "Angle",
              unit: "°",
              value: angleBuffer,
              onChangeText: handleAngleText,
            }
          : null
      }
      shortcuts={ROTATE_TOOL_SHORTCUTS}
    />
  );
}
