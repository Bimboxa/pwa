import { getToolsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Tool keys whose drawing state can be fulfilled by the 3D face-drawing mode.
// Openings (OPENING_SEGMENT, CUT_*) and STRIP drafts have their own tool keys
// and are excluded on purpose — their commit semantics are 2D-only.
const FACE_DRAW_TOOL_KEYS = new Set([
  ...getToolsForShape("POLYGON"),
  ...getToolsForShape("POLYLINE"),
]);

// Template-driven 3D face drawing is fully derived state: the template row
// click in PopperMapListings dispatches the regular 2D drawing state
// (newAnnotation + enabledDrawingMode); when the Dessin module is toggled to
// its 3D editor, that same state requests the 3D face-drawing mode instead.
// Mirrors selectIsObject3DPlacementActive.
export function selectIsTemplateFaceDrawActive(s) {
  const na = s.annotations.newAnnotation;
  return (
    FACE_DRAW_TOOL_KEYS.has(s.mapEditor.enabledDrawingMode) &&
    (na?.type === "POLYGON" || na?.type === "POLYLINE") &&
    !na?.isOpening &&
    Boolean(na?.annotationTemplateId) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
