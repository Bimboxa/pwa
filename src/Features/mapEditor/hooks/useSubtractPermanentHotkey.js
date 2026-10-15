import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { toggleSubtractPermanently } from "Features/mapEditor/mapEditorSlice";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

/**
 * S toggles « Soustraire définitivement » while a subtraction pick mode is
 * armed, in 2D and in 3D. Mounted by PopperSubtractHelper, i.e. exactly while
 * the helper is displayed; the event is tagged so that two mounted helpers
 * (2D + 3D) never toggle twice. Capture phase: the tool hotkeys (S = « Isoler
 * un segment ») already stand down during a pick mode, this only makes the
 * order explicit.
 */
export default function useSubtractPermanentHotkey() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e._subtractPermanentHandled) return;
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      if (document.activeElement?.isContentEditable) return;
      if (!selectSubtractPickAnnotationId(store.getState())) return;

      e._subtractPermanentHandled = true;
      dispatch(toggleSubtractPermanently());
      e.stopPropagation();
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [store, dispatch]);
}
