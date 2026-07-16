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
