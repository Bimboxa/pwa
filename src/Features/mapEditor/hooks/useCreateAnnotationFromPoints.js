import { useSelector, useDispatch } from "react-redux";

import {
  setEnabledDrawingMode,
  setSelectedNode,
  clearDrawingPolylinePoints,
  clearDrawingRectanglePoints,
} from "Features/mapEditor/mapEditorSlice";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

export default function useCreateAnnotationFromPoints() {
  const dispatch = useDispatch();

  const createAnnotation = useCreateAnnotation();

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  return async ({ points, type }) => {
    const annotation = await createAnnotation({
      ...newAnnotation,
      type,
      points,
      listingId: newAnnotation?.listingId ?? listingId,
      baseMapId,
      annotationTemplateId:
        newAnnotation?.annotationTemplateId ?? annotationTemplateId,
    });

    console.log("[MainMapEditor] new polyline created", annotation);

    // Reset drawing mode
    //dispatch(setEnabledDrawingMode(null));
    dispatch(setNewAnnotation({}));
    dispatch(setSelectedNode(null));

    if (type === "POLYLINE") {
      dispatch(clearDrawingPolylinePoints()); // Clear polyline points
    } else if (type === "RECTANGLE") {
      dispatch(clearDrawingRectanglePoints()); // Clear rectangle points
    }
  };
}
