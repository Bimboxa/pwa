import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import {
  setEnabledDrawingMode,
  setSelectedToolKeyForTemplate,
} from "Features/mapEditor/mapEditorSlice";

import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import {
  getDrawingToolsByShape,
  getDrawingToolByKey,
} from "Features/mapEditor/constants/drawingTools.jsx";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getLocateBusinessObjectDraftProps from "Features/businessObjects/utils/getLocateBusinessObjectDraftProps";

// Drawing shapes allowed to start a draw while the Dessin module is toggled to
// its 3D editor: OBJECT_3D (3D placement mode), POLYGON / POLYLINE
// (template-driven 3D face drawing), COTE (2-click cote) and RULER — other
// shapes would set a dead-end 2D drawing state.
const THREED_TOGGLED_DRAWABLE_SHAPES = [
  "OBJECT_3D",
  "POLYGON",
  "POLYLINE",
  "COTE",
  "RULER",
];

// ---------------------------------------------------------------------------
// useDrawFromTemplate — tool resolution + start-draw dispatches for one
// annotation template. Shared by PopperMapListings' AnnotationTemplateRow and
// the Dessin left panel rows.
// ---------------------------------------------------------------------------

export default function useDrawFromTemplate(annotationTemplate, listingId) {
  const dispatch = useDispatch();

  // data

  const selectedToolKey = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId[annotationTemplate?.id]
  );
  const rememberedDraftProps = useSelector(
    (s) => s.mapEditor.draftPropsByTemplateId?.[annotationTemplate?.id]
  );
  const isThreedToggledEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // Ouvrages module: drawing with a location template (the business-objects
  // listing's own templates) while an object is selected LOCATES it — the
  // draft carries the LOCATE_BUSINESS_OBJECT commit interceptor.
  const locatingBusinessObjectId = useSelector((s) =>
    s.viewers.selectedViewerKey === "BUSINESS_OBJECTS" &&
    annotationTemplate?.isBusinessObjectAnnotation
      ? (s.businessObjects?.selectedBusinessObjectId ?? null)
      : null
  );

  // helpers

  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape);
  const fallbackTool = annotationTemplate?.defaultTool
    ? (getDrawingToolByKey(annotationTemplate.defaultTool) ?? tools[0])
    : tools[0];
  const activeTool = selectedToolKey
    ? (getDrawingToolByKey(selectedToolKey) ?? fallbackTool)
    : fallbackTool;
  // REVOLUTION_AXIS: single fixed tool (circle by centre + radius) — the tool
  // button stays as a visual cue but never opens the picker.
  const hasFixedTool = drawingShape === "REVOLUTION_AXIS";
  const canDrawInCurrentEditor =
    !isThreedToggledEditor ||
    THREED_TOGGLED_DRAWABLE_SHAPES.includes(drawingShape);

  // handlers

  const dispatchDraw = (tool) => {
    dispatch(setSelectedListingId(listingId));
    const baseProps = {
      ...getNewAnnotationPropsFromAnnotationTemplate(
        annotationTemplate,
        rememberedDraftProps
      ),
      ...getLocateBusinessObjectDraftProps(locatingBusinessObjectId),
    };
    if (tool.annotationType) {
      dispatch(setNewAnnotation({ ...baseProps, type: tool.annotationType }));
    } else {
      dispatch(setNewAnnotation(baseProps));
    }
    dispatch(setEnabledDrawingMode(tool.drawingMode ?? tool.key));
  };

  const startDraw = () => {
    if (!activeTool || !canDrawInCurrentEditor) return;
    dispatchDraw(activeTool);
  };

  const selectToolAndDraw = (tool) => {
    dispatch(
      setSelectedToolKeyForTemplate({
        templateId: annotationTemplate?.id,
        toolKey: tool.key,
      })
    );
    if (!canDrawInCurrentEditor) return;
    dispatchDraw(tool);
  };

  return {
    drawingShape,
    tools,
    activeTool,
    hasFixedTool,
    canDrawInCurrentEditor,
    startDraw,
    selectToolAndDraw,
  };
}
