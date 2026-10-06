import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getImagePickDraftProps from "Features/imageAnnotations/utils/getImagePickDraftProps";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";
import { pickDrawingTool } from "Features/mapEditor/utils/filterDrawingToolsForEditor";

// Resolve the active drawing tool for a template, mirroring the rule used by the
// template rows (useDrawFromTemplate): per-template selected tool →
// template.defaultTool → first tool of the shape group, each only if it
// belongs to the shape group offered in `options.editor` ("2D" by default —
// pass selectDrawingToolsEditor(state) to offer the 3D-only tools in the
// Dessin module's 3D editor).
export function resolveActiveToolForTemplate(
  template,
  selectedToolKey,
  { editor = "2D" } = {}
) {
  const drawingShape = resolveDrawingShape(template);
  const tools = getDrawingToolsByShape(drawingShape, { editor });
  return pickDrawingTool(tools, [selectedToolKey, template?.defaultTool]);
}

// Single source of truth for the "start drawing from a template" dispatch
// sequence (shared by the panel row and the tool-group hotkeys). The template's
// flags ride along via getNewAnnotationPropsFromAnnotationTemplate.
// extraProps: caller overrides merged over the template-derived draft (e.g. a
// preset label, a transport-only commitInterceptor).
export default function startDrawFromTemplate(
  dispatch,
  { template, listingId, activeTool, rememberedProps, extraProps }
) {
  if (!template || !activeTool) return;
  dispatch(setSelectedListingId(listingId));
  const baseProps = {
    ...getNewAnnotationPropsFromAnnotationTemplate(template, rememberedProps),
    ...(extraProps ?? {}),
  };
  Object.assign(
    baseProps,
    getImagePickDraftProps(resolveDrawingShape(template), baseProps)
  );
  if (activeTool.annotationType) {
    dispatch(
      setNewAnnotation({ ...baseProps, type: activeTool.annotationType })
    );
  } else {
    dispatch(setNewAnnotation(baseProps));
  }
  // Tools that reuse another tool's interaction (RULER_*, REVOLUTION_AXIS_PLAN…)
  // declare it via `drawingMode`; their own key is not a valid drawing mode.
  dispatch(setEnabledDrawingMode(activeTool.drawingMode ?? activeTool.key));
}
