// Selection item (selectionSlice.selectedItems) of a whole annotation, the
// shape the 2D InteractionLayer builds on a click — used after a service
// created an annotation to select it right away.
export default function buildAnnotationSelectionItem(annotation) {
  if (!annotation?.id) return null;
  return {
    id: annotation.id,
    nodeId: annotation.id,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: annotation.type,
    listingId: annotation.listingId,
    annotationTemplateId: annotation.annotationTemplateId,
    pointId: null,
    partId: null,
    partType: null,
  };
}
