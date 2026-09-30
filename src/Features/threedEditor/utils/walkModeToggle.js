import { setWalkModeActive } from "Features/threedEditor/threedEditorSlice";

import { getActiveThreedEditor } from "../services/threedEditorRegistry";

// Single source of truth for the first-person walk mode toggle: the printed
// key (P for "Première Personne", matched on e.key so AZERTY layouts work)
// and the enter/exit rule shared by the keyboard shortcut (useWalkMode) and
// the bottom-right button (ButtonToggleWalkMode).
export const WALK_MODE_TOGGLE_KEY = "p";

// Pointer lock needs a user gesture: request it synchronously inside the
// keydown / click handler, BEFORE dispatching — the controller-mount effect
// runs too late for the browser to honour the request.
export function toggleWalkMode({ store, dispatch }) {
  const active = store.getState().threedEditor.walkMode.active;
  if (!active) {
    getActiveThreedEditor()?.sceneManager?.renderer?.domElement?.requestPointerLock?.();
  }
  dispatch(setWalkModeActive(!active));
}
