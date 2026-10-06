import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

// Selects the isolated segment once written (both editors read
// mapEditor.selectedNode + the selection slice — same pair as
// threedAnnotationMove's getCarriedAnnotationIdsFromSelection).
export default function selectIsolatedAnnotation(dispatch, annotation) {
  if (!annotation?.id) return;
  const node = {
    id: annotation.id,
    nodeId: annotation.id,
    nodeType: "ANNOTATION",
    annotationType: annotation.type,
    listingId: annotation.listingId,
  };
  dispatch(setSelectedNode(node));
  dispatch(
    setSelectedItem({
      ...node,
      type: "NODE",
      annotationTemplateId: annotation.annotationTemplateId,
    })
  );
}
