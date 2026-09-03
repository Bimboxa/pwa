import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setExtrudeModeActive,
  setMoveAnnotationModeActive,
  setRotateAnnotationModeActive,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

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

// Plain-letter shortcuts of the Dessin (MAP) module's 3D bottom toolbar:
// E = Extruder, D = Déplacer (annotation), R = Tourner (annotation) — the
// letters shown as badges in the toolbar buttons. Toggle semantics, exact
// parity with the buttons (the threedEditorSlice reducers own the mode
// mutual exclusion).
//
// Scoped to "Dessin module + 3D editor active". useRightPanelToolHotkeys
// yields "E" (Élévation) in that exact context so listener order never
// decides; "D" and "R" have no other owner in 3D ("R" belongs to walk mode
// and OBJECT_3D placement, both of which make this hook inert). Inert while
// a draw is armed (a draw owns its own letters) and in walk mode. Mounted
// from MainThreedEditor — NOT from BottomToolbarThreed, which unmounts as
// soon as a mode's own toolbar swaps in (the letters must keep toggling the
// active mode off).
export default function useDessinToolHotkeysThreed() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;

      const letter = e.key.toLowerCase();
      if (letter !== "e" && letter !== "d" && letter !== "r") return;

      const s = store.getState();
      if (s.viewers.selectedViewerKey !== "MAP") return;
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(s))) return;
      // Walk mode owns the keyboard (arrows, Space, W to exit).
      if (s.threedEditor.walkMode.active) return;
      // A draw owns its own letters.
      if (s.mapEditor.enabledDrawingMode) return;

      if (letter === "e") {
        dispatch(setExtrudeModeActive(!s.threedEditor.extrudeMode.active));
      } else if (letter === "d") {
        dispatch(
          setMoveAnnotationModeActive(!s.threedEditor.moveAnnotationMode.active)
        );
      } else {
        dispatch(
          setRotateAnnotationModeActive(
            !s.threedEditor.rotateAnnotationMode.active
          )
        );
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [dispatch, store]);
}
