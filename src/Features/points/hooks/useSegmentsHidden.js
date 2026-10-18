import useSegmentsEdgeFlag from "./useSegmentsEdgeFlag";

// Unified state + toggle for the per-segment "hidden" flag
// (`hiddenSegmentsIdx` → persisted as `hiddenSegmentsPointIds`) of the
// selected segment(s). Same write path as the Backspace hotkey
// (applyHideSegmentOps in MainMapEditorV3), so the toolbar switch and the
// hotkey stay in sync. No mutually-exclusive counterpart flag.
export default function useSegmentsHidden() {
  return useSegmentsEdgeFlag("hiddenSegmentsIdx");
}
