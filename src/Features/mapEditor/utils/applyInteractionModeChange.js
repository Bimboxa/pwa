import { setInteractionMode, setSoloMode } from "Features/popperMapListings/popperMapListingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

// Shared side effects for switching the editor interaction mode
// ("DRAW" | "EDIT" | "SELECT"). Used by both the panel ToggleButtonGroup
// (PopperMapListings) and the D/M/S keyboard shortcuts
// (useInteractionModeHotkeys), so the two paths can never drift.
//
//  - entering SELECT   → enable solo mode
//  - leaving SELECT    → disable solo mode
//  - leaving EDIT      → clear the ANNOTATION_TEMPLATE edit target, if any
//
// Callers guard the no-op case (next falsy / next === current) themselves.
export default function applyInteractionModeChange(
  dispatch,
  { current, next, selectedItem }
) {
  if (next === "SELECT") {
    dispatch(setSoloMode(true));
  } else if (current === "SELECT") {
    dispatch(setSoloMode(false));
  }
  if (current === "EDIT" && next !== "EDIT") {
    if (selectedItem?.type === "ANNOTATION_TEMPLATE") {
      dispatch(setSelectedItem(null));
    }
  }
  dispatch(setInteractionMode(next));
}
