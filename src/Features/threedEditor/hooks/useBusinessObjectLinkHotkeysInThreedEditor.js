import { useEffect } from "react";
import { useDispatch, useStore } from "react-redux";

import { setLinkingBusinessObjectId } from "Features/businessObjects/businessObjectsSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

/**
 * Escape exits the business-object picking mode (LINK / EXCLUDE) while the 3D
 * editor is displayed — useSubtractPickHotkeysInThreedEditor pattern. In 2D
 * that lives in InteractionLayer's keydown switch, behind other 2D cases
 * (selected part / point…): this hook makes the exit explicit in 3D.
 */
export default function useBusinessObjectLinkHotkeysInThreedEditor() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName))
        return;

      const state = store.getState();
      // Effective key, not the raw module key: the shortcut follows the editor
      // actually displayed (the Quantités module toggled to 3D).
      if (!isThreedFamilyViewerKey(selectEffectiveViewerKey(state))) return;
      if (!state.businessObjects.linkingBusinessObjectId) return;

      dispatch(setLinkingBusinessObjectId(null));
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, dispatch]);
}
