import { useDispatch } from "react-redux";

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
// useSelectAnnotationFromPanel — "Sélectionner" action of the panel's
// annotation subview: selects the annotation on the map and zooms to it
// (DatagridAnnotations handleViewOnMap pattern). Deliberately NOT dispatched
// on row clicks / prev-next arrows — those only navigate the panel
// (setDetailAnnotationId); the selection is an explicit user action.
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
  };
}
