import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setSweepProfileAnnotationId } from "Features/mapEditor/mapEditorSlice";
import { selectSweepPickAnnotationId } from "Features/mapEditor/utils/sweepPickMode";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

/**
 * Escape exits the « Extruder le long d'une ligne » pick mode while the 3D
 * editor is displayed (the 2D InteractionLayer owns it in its keydown switch,
 * but it is not mounted here — see useSubtractPickHotkeysInThreedEditor).
 */
export default function useSweepPickHotkeysInThreedEditor() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName))
        return;

      const state = store.getState();
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      if (!selectSweepPickAnnotationId(state)) return;

      dispatch(setSweepProfileAnnotationId(null));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch]);
}
