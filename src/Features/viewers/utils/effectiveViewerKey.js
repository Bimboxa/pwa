// POINT_OF_VIEW is a "meta" viewer: it displays the MAP or THREED editor
// (per s.pov.viewerMode) with the capture framing forced on. Components that
// gate their behavior on the selected viewer should use the effective key so
// the underlying editor behaves as if it were the active viewer.

export const selectIsPovViewer = (s) =>
  s.viewers.selectedViewerKey === "POINT_OF_VIEW";

export const selectEffectiveViewerKey = (s) => {
  const key = s.viewers.selectedViewerKey;
  if (key !== "POINT_OF_VIEW") return key;
  return s.pov.viewerMode === "THREED" ? "THREED" : "MAP";
};

// The capture framing ("Export rapide" mask + rect + legend) is active when
// the Export tool enabled it OR when the POV viewer is displayed. Editing
// interactions gated on image mode must use this derived flag so the POV
// viewer freezes them exactly like the Export tool does.
export const selectCaptureFramingActive = (s) =>
  s.mapEditor.imageModeEnabled || selectIsPovViewer(s);
