import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import {
  setSubtractSourceAnnotationId,
  setSubtractTargetAnnotationId,
} from "Features/mapEditor/mapEditorSlice";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

/**
 * Escape exits the subtraction pick mode while the 3D editor is displayed.
 * In 2D that lives in InteractionLayer's keydown switch, but InteractionLayer
 * is not mounted here — MainThreedEditor replaces it.
 */
export default function useSubtractPickHotkeysInThreedEditor() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName))
        return;

      const state = store.getState();
      // Effective key, not the raw module key: the shortcut follows the editor
      // actually displayed (e.g. the Dessin module toggled to 3D).
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      if (!selectSubtractPickAnnotationId(state)) return;

      dispatch(setSubtractSourceAnnotationId(null));
      dispatch(setSubtractTargetAnnotationId(null));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch]);
}
