import { CAPTURE_TOOLBAR_WIDTH } from "../components/ToolbarCaptureCondensed";

// Width occluded on the right of the capture host by a panel floating over
// the viewport, per framing owner — the single source every frame-geometry
// consumer (overlay, save bar, captures, POV snapshot) must share so the
// exported crop always matches the displayed rect:
// - "Export rapide" (imageMode): the open right panel.
// - Global Capture tool (hotkey V): its own drawer — the condensed black band
//   or the full tabbed panel — so the frame's right edge stays visible.
// - POV framing: 0 on purpose — the frame must not move with the panel, so
//   snapshot and restore always agree on the same rect.
export const selectCaptureRightInset = (s) => {
  const panelKey = s.rightPanel.selectedMenuItemKey;
  if (s.mapEditor.imageModeEnabled) return panelKey ? s.rightPanel.width : 0;
  if (s.mapEditor.captureToolActive && panelKey === "CAPTURE")
    return s.mapEditor.capturePanelCondensed
      ? CAPTURE_TOOLBAR_WIDTH
      : s.rightPanel.width;
  return 0;
};
