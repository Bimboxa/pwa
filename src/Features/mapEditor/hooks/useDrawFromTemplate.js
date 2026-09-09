import { useMemo } from "react";
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
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

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
  // draft carries the LOCATE_BUSINESS_OBJECT commit interceptor. Only for
  // located listings (opt-in listing.canLocateBusinessObjects, read on the
  // template's own listing through the Dexie mirror listingsById).
  const locatingBusinessObjectId = useSelector((s) => {
    if (
      !isBusinessObjectsModuleKey(s.viewers.selectedViewerKey) ||
      !annotationTemplate?.isBusinessObjectAnnotation
    )
      return null;
    const listing = s.listings.listingsById?.[annotationTemplate.listingId];
    if (!canLocateBusinessObjects(listing)) return null;
    return s.businessObjects?.selectedBusinessObjectId ?? null;
  });

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
  // Props of the next draft (shape defaults → template → remembered toolbar
  // edits). Shared by dispatchDraw and the rows previewing e.g. the stroke width.
  const nextDraftProps = useMemo(
    () =>
      getNewAnnotationPropsFromAnnotationTemplate(
        annotationTemplate,
        rememberedDraftProps
      ),
    [annotationTemplate, rememberedDraftProps]
  );

  // handlers

  const dispatchDraw = (tool) => {
    dispatch(setSelectedListingId(listingId));
    const baseProps = {
      ...nextDraftProps,
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
    nextDraftProps,
    startDraw,
    selectToolAndDraw,
  };
}
