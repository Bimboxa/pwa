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
import { selectDrawingToolsEditor } from "Features/meshPaint/utils/meshBrushSelectors";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolsByShape } from "Features/mapEditor/constants/drawingTools.jsx";
import { pickDrawingTool } from "Features/mapEditor/utils/filterDrawingToolsForEditor";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getImagePickDraftProps from "Features/imageAnnotations/utils/getImagePickDraftProps";
import getLocateBusinessObjectDraftProps from "Features/businessObjects/utils/getLocateBusinessObjectDraftProps";
import getLinkBusinessObjectDraftProps from "Features/businessObjects/utils/getLinkBusinessObjectDraftProps";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";
import { isLocationTemplateForListing } from "Features/businessObjects/utils/getLocationTemplateListingIds";

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
  // DISC: 2-click centre / radius on a base map plane (3D circle preview).
  "DISC",
];

// ---------------------------------------------------------------------------
// useDrawFromTemplate — tool resolution + start-draw dispatches for one
// annotation template. Shared by PopperMapListings' AnnotationTemplateRow and
// the Dessin left panel rows.
//
// options.locateListing: the ACTIVE object's business-objects listing, passed
// by the locate-mode blocks of PopperMapListings only — drawing a location
// template of that listing (its own templates or its libraries') LOCATES the
// object (see below). Elsewhere (Dessin panel, regular listing rows) a draw
// while an object is active LINKS the annotation to it.
// ---------------------------------------------------------------------------

export default function useDrawFromTemplate(
  annotationTemplate,
  listingId,
  { locateListing = null } = {}
) {
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
  // "3D" in the Dessin module's 3D editor: the tool lists then offer the
  // 3D-only tools (« Pinceau »).
  const toolsEditor = useSelector(selectDrawingToolsEditor);
  // Ouvrages module: drawing a location template of the ACTIVE object's
  // listing — one of the listing's own templates, or a template of one of
  // its libraries (listing.locationTemplateListingIds, the annotation then
  // stays in its library listing) — LOCATES the object: the draft carries
  // the LOCATE_BUSINESS_OBJECT commit interceptor. The ACTIVE id (not the
  // selection) is what survives the map selection each committed location
  // produces, so several base maps can be located in a row. Only for located
  // listings (opt-in listing.canLocateBusinessObjects); the libraries are
  // resolved through the Dexie mirror listingsById.
  const isLocateTemplate = useSelector(
    (s) =>
      isBusinessObjectsModuleKey(s.viewers.selectedViewerKey) &&
      canLocateBusinessObjects(locateListing) &&
      isLocationTemplateForListing(
        annotationTemplate,
        locateListing,
        s.listings.listingsById
      )
  );
  const activeBusinessObjectId = useSelector((s) =>
    isBusinessObjectsModuleKey(s.viewers.selectedViewerKey)
      ? (s.businessObjects?.activeBusinessObjectId ?? null)
      : null
  );
  const locatingBusinessObjectId = isLocateTemplate
    ? activeBusinessObjectId
    : null;
  // Any OTHER template drawn while an object is active LINKS the created
  // annotation to it (plain rel, LINK_BUSINESS_OBJECT interceptor). Distinct
  // from the slice's linkingBusinessObjectId (map picking mode).
  const linkDrawBusinessObjectId = isLocateTemplate
    ? null
    : activeBusinessObjectId;

  // helpers

  const drawingShape = resolveDrawingShape(annotationTemplate);
  const tools = getDrawingToolsByShape(drawingShape, { editor: toolsEditor });
  // Per-template selected tool → template.defaultTool → first tool, each
  // only if it belongs to the editor's list: a brush remembered from the 3D
  // editor (selectedToolKeyByTemplateId is shared) falls back in 2D, and is
  // picked again back in 3D.
  const activeTool = pickDrawingTool(tools, [
    selectedToolKey,
    annotationTemplate?.defaultTool,
  ]);
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
      ...getLinkBusinessObjectDraftProps(linkDrawBusinessObjectId),
    };
    Object.assign(baseProps, getImagePickDraftProps(drawingShape, baseProps));
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
