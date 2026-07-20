import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Template-driven 3D cote drawing is fully derived state: the COTE template
// row click in PopperMapListings dispatches the regular 2D drawing state
// (newAnnotation + enabledDrawingMode); when the module is toggled to its 3D
// editor, that same state requests the 3D dimension (2-click) mode instead.
// Mirrors selectIsTemplateFaceDrawActive.
export function selectIsTemplateCoteDrawActive(s) {
  const na = s.annotations.newAnnotation;
  return (
    s.mapEditor.enabledDrawingMode === "COTE_TWO_CLICK" &&
    na?.type === "COTE" &&
    Boolean(na?.annotationTemplateId) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
