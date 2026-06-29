import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import {
  getDrawingToolsByShape,
  getDrawingToolByKey,
} from "Features/mapEditor/constants/drawingTools.jsx";

// Resolve the active drawing tool for a template, mirroring the rule used by the
// template rows: per-template selected tool → template.defaultTool → first tool
// of the shape group.
export function resolveActiveToolForTemplate(template, selectedToolKey) {
  const drawingShape = resolveDrawingShape(template);
  const tools = getDrawingToolsByShape(drawingShape);
  const fallbackTool = template?.defaultTool
    ? (getDrawingToolByKey(template.defaultTool) ?? tools[0])
    : tools[0];
  return selectedToolKey
    ? (getDrawingToolByKey(selectedToolKey) ?? fallbackTool)
    : fallbackTool;
}

// Single source of truth for the "start drawing from a template" dispatch
// sequence (shared by the panel row and the L/S hotkeys). The template's flags
// (e.g. isFreeAnnotation) ride along via getNewAnnotationPropsFromAnnotationTemplate.
export default function startDrawFromTemplate(
  dispatch,
  { template, listingId, activeTool }
) {
  if (!template || !activeTool) return;
  dispatch(setSelectedListingId(listingId));
  const baseProps = getNewAnnotationPropsFromAnnotationTemplate(template);
  if (activeTool.annotationType) {
    dispatch(
      setNewAnnotation({ ...baseProps, type: activeTool.annotationType })
    );
  } else {
    dispatch(setNewAnnotation(baseProps));
  }
  dispatch(setEnabledDrawingMode(activeTool.key));
}
