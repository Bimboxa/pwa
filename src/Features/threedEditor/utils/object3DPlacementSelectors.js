import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// OBJECT_3D placement mode is fully derived state: the template row click in
// PopperMapListings dispatches the regular 2D drawing state (newAnnotation +
// enabledDrawingMode ONE_CLICK); when the Dessin module is toggled to its 3D
// editor, that same state activates the 3D placement mode instead.
export function selectIsObject3DPlacementActive(s) {
  return (
    s.mapEditor.enabledDrawingMode === "ONE_CLICK" &&
    s.annotations.newAnnotation?.type === "OBJECT_3D" &&
    Boolean(s.annotations.newAnnotation?.object3D?.fileName) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
