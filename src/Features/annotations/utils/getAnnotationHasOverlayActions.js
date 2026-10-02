import isOpeningAnnotation from "./isOpeningAnnotation";

// True when the 2D node of this annotation renders the quick-action row above
// the selection (NodeSegmentLengthsStatic overlay: "Dupliquer", "Evider",
// "Plus d'outils"). ToolbarEditAnnotation then drops its own copy of those
// actions; every other type keeps them in the toolbar.
// - openings use the `simple` overlay (single cote, no action buttons);
// - isMesh3d disables vertex editing, hence the whole overlay.
export default function getAnnotationHasOverlayActions(annotation) {
  if (!annotation || annotation.isMesh3d) return false;
  if (isOpeningAnnotation(annotation)) return false;
  return ["POLYLINE", "POLYGON", "STRIP", "LINEAR_LAYOUT"].includes(
    annotation.type
  );
}
