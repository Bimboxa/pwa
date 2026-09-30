import { useEffect } from "react";

import { useDispatch, useStore } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

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
// are selected: deletes THOSE parts, not the annotation.
//
// Capture phase + stopPropagation: it pre-empts the annotation delete
// shortcut (useDeleteAnnotationOnKeyboardInThreedEditor), which would open
// the "delete the annotation" dialog. Without a part selection the event is
// left untouched.
export default function useDeleteMesh3dPartsOnKeyboard() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (isEditableTarget(e.target)) return;
      if (isEditableTarget(document.activeElement)) return;

      const state = store.getState();
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      // A tool that owns the keyboard (typed extrude value…) keeps Backspace;
      // in walk mode Backspace / Delete clear the walk tool's traces.
      if (state.threedEditor.extrudeMode.active) return;
      if (state.threedEditor.walkMode.active) return;

      const selectedItem = state.selection.selectedItems[0];
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
