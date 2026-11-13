import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { BASE_MAP_LINK_TYPE } from "./baseMapLinkPredicates";

// Drawing a section mark ("trait de coupe") from the 3D editor is fully
// derived state, like the revolution axis
// (selectIsRevolutionAxisDrawThreedActive): the « Dessiner un trait de
// coupe » command arms the regular 2D drawing state (BASE_MAP_LINK draft +
// its segment mode); when the Fonds de plan or Dessin module shows its 3D editor, that
// same state requests the 3D drawing mode (useTemplateFaceDrawBridge →
// threedEditor.drawingMode.active), where the mark rides a two-click flow of
// useDrawingPointerHandlers with its own commit
// (commitDrawnBaseMapLinkService).
//
// Only a NEW mark (source, on a horizontal plan) is drawn in 3D: locating a
// mark on a vertical base map (clone draft) stays a 2D tool.
export function isBaseMapLinkDraftFor3d(na) {
  return na?.type === BASE_MAP_LINK_TYPE && !na?.sourceLinkAnnotationId;
}

export function selectIsBaseMapLinkDrawThreedActive(s) {
  return (
    Boolean(s.mapEditor.enabledDrawingMode) &&
    isBaseMapLinkDraftFor3d(s.annotations.newAnnotation) &&
    (s.viewers.selectedViewerKey === "BASE_MAPS" ||
      s.viewers.selectedViewerKey === "MAP") &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
