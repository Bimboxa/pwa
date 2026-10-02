import { getToolsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { isFaceCutDrawingMode } from "Features/threedFaceCut/utils/faceCutTools";
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
// Template-less drawing: the "Dessin" tool (startTemplatelessDraw) of the
// Dessin module, shown in its 3D editor — started there or carried over from
// the 2D editor, like a template draft. Same machinery as the template face
// draw; only the commit differs (template-less annotations, or a cut of the
// selected face — see useDrawingPointerHandlers). Nothing on the draft marks
// it as 3D: what it commits is decided at commit time.
export function isTemplatelessDraft(newAnnotation) {
  return Boolean(
    newAnnotation?.isTemplateless && !newAnnotation?.annotationTemplateId
  );
}

export function selectIsThreedTemplatelessDrawActive(s) {
  const na = s.annotations.newAnnotation;
  return (
    isTemplatelessDraft(na) &&
    (na.type === "POLYGON" || na.type === "POLYLINE") &&
    !na.isOpening &&
    FACE_DRAW_TOOL_KEYS.has(s.mapEditor.enabledDrawingMode) &&
    s.viewers.selectedViewerKey === "MAP" &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}

// "Coupe face" tool (FACE_CUT group) armed in the Dessin module's 3D editor:
// the same machinery draws the cutting path (see useDrawingPointerHandlers).
export function selectIsFaceCutDrawActive(s) {
  return (
    isFaceCutDrawingMode(s.mapEditor.enabledDrawingMode) &&
    s.viewers.selectedViewerKey === "MAP" &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}

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
