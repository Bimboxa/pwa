import { useDispatch } from "react-redux";

import { setDetailAnnotationId } from "Features/panelDrawing/panelDrawingSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedNode,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

// ---------------------------------------------------------------------------
// useSelectAnnotationFromPanel — selects one annotation from the Dessin panel
// (annotations list row, prev/next arrows): selects it on the map, zooms to
// it (DatagridAnnotations handleViewOnMap pattern) and opens the panel's
// annotation subview. The right panel stays untouched — the properties are
// displayed in the left panel (PanelAnnotationDetail).
// ---------------------------------------------------------------------------

export default function useSelectAnnotationFromPanel() {
  const dispatch = useDispatch();

  return (annotation) => {
    if (!annotation) return;
    if (annotation.baseMapId)
      dispatch(setSelectedMainBaseMapId(annotation.baseMapId));
    dispatch(
      setSelectedNode({
        nodeId: annotation.id,
        nodeType: "ANNOTATION",
        nodeListingId: annotation.listingId,
        annotationType: annotation.type,
        origin: "LISTING",
      })
    );
    dispatch(
      setSelectedItem({
        id: annotation.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        nodeId: annotation.id,
        annotationType: annotation.type,
        listingId: annotation.listingId,
        entityId: annotation.entityId,
        annotationTemplateId: annotation.annotationTemplateId,
      })
    );
    dispatch(setShowAnnotationsProperties(true));
    if (annotation.points?.length > 0) {
      dispatch(setZoomTo(annotation.points[0]));
    } else if (annotation.x != null) {
      dispatch(setZoomTo({ x: annotation.x, y: annotation.y }));
    }
    dispatch(setDetailAnnotationId(annotation.id));
  };
}
