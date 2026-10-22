import { useEffect } from "react";

import { useDispatch, useStore } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import {
  setSelectedPartIds,
  setSubSelection,
} from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { isFaceCutDrawingMode } from "Features/threedFaceCut/utils/faceCutTools";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import removeSurfacePiecesService from "Features/threedFaceCut/services/removeSurfacePiecesService";
import resolveSurfaceFaceParts from "Features/threedFaceCut/services/resolveSurfaceFaceParts";
import { getSelectedSurfacePieces } from "Features/threedFaceCut/utils/surfacePieceParts";

import deleteMesh3dPartsService from "../services/deleteMesh3dPartsService";
import getMesh3dPartsDeleteMessage from "../utils/getMesh3dPartsDeleteMessage";
import { getSelectedMesh3dParts } from "../utils/mesh3dPartIds";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Delete / Backspace in the 3D editor while faces / edges of a mesh annotation
// (or pieces of a cut surface host) are selected: deletes THOSE parts, not
// the annotation. Escape drops the
// part selection (back to the whole annotation, like the toolbar's close
// button) — the step after leaving the vertex offset mode.
//
// Capture phase + stopPropagation: it pre-empts the annotation delete
// shortcut (useDeleteAnnotationOnKeyboardInThreedEditor), which would open
// the "delete the annotation" dialog. Without a part selection the event is
// left untouched.
export default function useDeleteMesh3dPartsOnKeyboard() {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const pieceNotFoundS = "Pièce introuvable";
  const pieceLockedS =
    "Découper (H / V) pour isoler la face avant de la supprimer";

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isEscape = e.key === "Escape";
      if (!isEscape && e.key !== "Delete" && e.key !== "Backspace") return;
      if (isEditableTarget(e.target)) return;
      if (isEditableTarget(document.activeElement)) return;

      const state = store.getState();
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      // A tool that owns the keyboard (typed extrude / vertex offset value…)
      // keeps Backspace and Escape; in walk mode Backspace / Delete clear the
      // walk tool's traces.
      if (state.threedEditor.extrudeMode.active) return;
      if (state.threedEditor.vertexOffsetMode.active) return;
      if (state.threedEditor.walkMode.active) return;
      if (isEscape) {
        // Only with no other 3D tool armed: those own Escape themselves.
        const t = state.threedEditor;
        if (
          t.drawingMode.active ||
          t.meshingMode.active ||
          t.moveBaseMapMode.active ||
          t.rotateBaseMapMode.active ||
          t.moveAnnotationMode.active ||
          t.rotateAnnotationMode.active ||
          t.baseMapsGridMode.active ||
          t.isolateFaceMode.active ||
          t.mergeFacesMode.active
        ) {
          return;
        }
        const item = state.selection.selectedItems[0];
        const parts = getSelectedMesh3dParts(
          item,
          state.selection.selectedPartIds
        );
        const pieces = getSelectedSurfacePieces(
          item,
          state.selection.selectedPartIds
        );
        if (!parts.length && !pieces.length) return;
        e.preventDefault();
        e.stopPropagation();
        dispatch(setSelectedPartIds([]));
        dispatch(setSubSelection({ partId: null, partType: null }));
        return;
      }
      // "Coupe face" tools type dimensions / distances: Backspace erases the
      // last digit (useDrawingPointerHandlers, bubble phase) — let it through,
      // only the browser default is blocked.
      if (isFaceCutDrawingMode(state.mapEditor.enabledDrawingMode)) {
        e.preventDefault();
        return;
      }
      // While drawing, the selected face is where the line is cut into:
      // nor the parts nor the annotation get deleted. The key still reaches
      // the drawing (useDrawingPointerHandlers, bubble phase): Backspace
      // erases the typed length / `*N` repetition count — the other delete
      // hooks stand down while drawing.
      if (state.threedEditor.drawingMode.active) {
        e.preventDefault();
        return;
      }

      const selectedItem = state.selection.selectedItems[0];
      // Pieces of a cut surface host (lathe, shell…): removed from the host.
      const pieces = getSelectedSurfacePieces(
        selectedItem,
        state.selection.selectedPartIds
      );
      if (pieces.length) {
        e.preventDefault();
        e.stopPropagation();
        // A REMOVE entry drops a whole piece: a face that is only a region
        // of its piece (a band of a lathe) must be cut out first.
        const faces = resolveSurfaceFaceParts({
          editor: getActiveThreedEditor(),
          annotationId: selectedItem.nodeId,
          parts: pieces,
          angleDeg: state.threedEditor.faceSelectionAngleDeg,
        });
        if (
          faces.length !== pieces.length ||
          !faces.every((face) => face.isWholePiece)
        ) {
          dispatch(setToaster({ message: pieceLockedS, severity: "info" }));
          return;
        }
        removeSurfacePiecesService({
          editor: getActiveThreedEditor(),
          annotationId: selectedItem.nodeId,
          pieceIndices: [...new Set(pieces.map((part) => part.pieceIndex))],
          dispatch,
        })
          .then((result) => {
            if (!result.ok) {
              dispatch(
                setToaster({ message: pieceNotFoundS, severity: "warning" })
              );
            }
          })
          .catch((err) =>
            console.error("[threedFaceCut] piece delete failed", err)
          );
        return;
      }
      const parts = getSelectedMesh3dParts(
        selectedItem,
        state.selection.selectedPartIds
      );
      if (!parts.length) return;

      e.preventDefault();
      e.stopPropagation();
      deleteMesh3dPartsService({
        annotationId: selectedItem.nodeId,
        parts,
        dispatch,
        editor: getActiveThreedEditor(),
      })
        .then((result) => {
          const message = getMesh3dPartsDeleteMessage(result);
          if (message) dispatch(setToaster({ message, severity: "warning" }));
        })
        .catch((err) =>
          console.error("[annotationMesh3d] part delete failed", err)
        );
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [dispatch, store]);
}
