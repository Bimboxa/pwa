import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// OBJECT_3D placement mode is fully derived state: the template row click in
// PopperMapListings dispatches the regular 2D drawing state (newAnnotation +
// enabledDrawingMode ONE_CLICK); when the Dessin module is toggled to its 3D
// editor, that same state activates the 3D placement mode instead.
export function selectIsObject3DModelPlacementActive(s) {
  return (
    s.mapEditor.enabledDrawingMode === "ONE_CLICK" &&
    s.annotations.newAnnotation?.type === "OBJECT_3D" &&
    Boolean(s.annotations.newAnnotation?.object3D?.fileName) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}

// Same derived mode for the instances of a block (Features/blocks, armed
// from the library by usePlaceBlockInstance): the same controller, with the
// block's prototypes as preview (useBlockInstancePlacementHandlers).
export function selectIsBlockInstancePlacementActive(s) {
  return (
    s.mapEditor.enabledDrawingMode === "ONE_CLICK" &&
    s.annotations.newAnnotation?.type === "BLOCK_INSTANCE" &&
    Boolean(s.annotations.newAnnotation?.instanceOfBlockId) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}

// A one-click 3D placement owns the pointer: an imported model OR a block
// instance. What the rest of the 3D editor gates on.
export function selectIsObject3DPlacementActive(s) {
  return (
    selectIsObject3DModelPlacementActive(s) ||
    selectIsBlockInstancePlacementActive(s)
  );
}
