import { useDispatch, useSelector } from "react-redux";

import { setSelectedZoneId } from "../zoningsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import { setInteractionMode } from "Features/popperMapListings/popperMapListingsSlice";

import db from "App/db/db";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function useArmZoneDrawing() {
  const dispatch = useDispatch();

  const selectedToolKeyByTemplateId = useSelector(
    (s) => s.mapEditor.selectedToolKeyByTemplateId
  );

  // Selecting a zone arms the drawing of its delimitation polygon: the popper
  // shows the zone's template row selected, and the map editor is ready to
  // draw with the template's last used tool (default: click-click polygon).
  const armZoneDrawing = async (zone) => {
    dispatch(setSelectedZoneId(zone.id));
    dispatch(setSelectedListingId(zone.listingId));

    const template = zone.templateId
      ? await db.annotationTemplates.get(zone.templateId)
      : null;
    if (!template || template.deletedAt) return;

    dispatch(
      setSelectedItem({
        id: template.id,
        type: "ANNOTATION_TEMPLATE",
        listingId: zone.listingId,
      })
    );

    const toolKey =
      selectedToolKeyByTemplateId?.[template.id] ??
      template.defaultTool ??
      "POLYGON_CLICK";
    const tool =
      getDrawingToolByKey(toolKey) ?? getDrawingToolByKey("POLYGON_CLICK");
    if (!tool) return;

    const baseProps = getNewAnnotationPropsFromAnnotationTemplate(template);
    dispatch(
      setNewAnnotation(
        tool.annotationType
          ? { ...baseProps, type: tool.annotationType }
          : baseProps
      )
    );
    dispatch(setInteractionMode("DRAW"));
    dispatch(setEnabledDrawingMode(tool.key));
  };

  return armZoneDrawing;
}
