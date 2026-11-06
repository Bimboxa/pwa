import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { HIDE_ANNOTATION_MODE } from "Features/commandsToolbar/commands/hideAnnotation/hideAnnotationMode";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

/**
 * Escape exits the « Masquer l'annotation » pick mode while the 3D editor is
 * displayed (the 2D InteractionLayer owns it in its keydown switch — see
 * useSubtractPickHotkeysInThreedEditor). The registry of hidden items is kept.
 */
export default function useHideAnnotationHotkeysInThreedEditor() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName))
        return;

      const state = store.getState();
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      if (state.mapEditor.enabledDrawingMode !== HIDE_ANNOTATION_MODE) return;

      dispatch(setEnabledDrawingMode(null));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch]);
}
