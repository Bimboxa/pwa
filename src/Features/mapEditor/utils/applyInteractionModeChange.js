import { setInteractionMode } from "Features/popperMapListings/popperMapListingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

// Shared side effects for switching the editor interaction mode
// (null | "DRAW" | "EDIT" | "SELECT" — null = "no mode", the default). Used by
// the module flows that force a mode (ZONES arming, POV framing exit) and by
// the residual-mode reset (useResetInteractionMode).
//
//  - leaving EDIT      → clear the ANNOTATION_TEMPLATE edit target, if any
//
// Callers guard the no-op case (next === current) themselves.
export default function applyInteractionModeChange(
  dispatch,
  { current, next, selectedItem }
) {
  if (current === "EDIT" && next !== "EDIT") {
    if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
      dispatch(setSelectedItem(null));
    }
  }
  dispatch(setInteractionMode(next));
}
