import { getToolsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { isTemplatelessDraft } from "./templateFaceDrawSelectors";

// Drawing modes a RULER draft rides: the RULER_CLICK / RULER_SEGMENT tools
// delegate to the polyline modes (`tool.drawingMode`), so in Redux a ruler
// draft is `newAnnotation.type === "RULER"` + a POLYLINE_* mode — only the
// type tells it apart from a polyline.
export const RULER_DRAWING_MODES = new Set(
  getToolsForShape("RULER").map(
    (key) => getDrawingToolByKey(key)?.drawingMode ?? key
  )
);

export function isRulerDraftFor3d(newAnnotation, enabledDrawingMode) {
  return (
    newAnnotation?.type === "RULER" &&
    RULER_DRAWING_MODES.has(enabledDrawingMode)
  );
}

// Template-driven 3D ruler drawing is fully derived state, like the cote
// (selectIsTemplateCoteDrawActive): the RULER template row dispatches the
// regular 2D drawing state; shown in a 3D editor, that same state requests
// the 3D drawing mode. The template-less ruler ("Dessin" tool on its RULER
// type) rides the same machinery — only the commit differs
// (commitDrawnRulerService).
export function selectIsTemplateRulerDrawActive(s) {
  const na = s.annotations.newAnnotation;
  return (
    isRulerDraftFor3d(na, s.mapEditor.enabledDrawingMode) &&
    (Boolean(na?.annotationTemplateId) || isTemplatelessDraft(na)) &&
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
}
