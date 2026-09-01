import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import applyInteractionModeChange from "../utils/applyInteractionModeChange";

// The interaction mode toggle (DRAW / EDIT / SELECT) has no UI anymore, but
// other modules still set the mode for their own flows (ZONES arming forces
// DRAW, exiting the POV framing forces SELECT). Landing back in the Dessin
// module with that residual mode would silently change the panel behavior —
// reset it to "no mode" (the default draw-like behavior). The ?mode=viewer
// lock keeps its forced SELECT (read-only shared link).
export default function useResetInteractionMode() {
  const dispatch = useDispatch();
  const store = useStore();

  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);

  useEffect(() => {
    if (selectedViewerKey !== "MAP") return;
    if (viewerMode) return;
    if (interactionMode == null) return;
    applyInteractionModeChange(dispatch, {
      current: interactionMode,
      next: null,
      selectedItem: store.getState().selection.selectedItems[0] || null,
    });
  }, [selectedViewerKey, viewerMode, interactionMode, dispatch, store]);
}
