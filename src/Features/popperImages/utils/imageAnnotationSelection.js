// Selection rule of the photos (IMAGE annotations): whenever the selected
// item IS an image, every other image (photo, leader, anchor, badge, tile)
// is veiled. Works on the selection items alone (annotationType is carried
// by the NODE item — InteractionLayer, useAnnotationLabelDragHandlers).

export function getSelectedImageAnnotationId(selectedItems) {
  if (!selectedItems || selectedItems.length !== 1) return null;
  const it = selectedItems[0];
  if (!it) return null;
  if (
    it.type === "NODE" &&
    it.nodeType === "ANNOTATION" &&
    it.annotationType === "IMAGE"
  ) {
    return it.nodeId ?? it.id ?? null;
  }
  if (it.type === "ANNOTATION_LABEL" && it.parentAnnotationType === "IMAGE") {
    return it.annotationId ?? null;
  }
  return null;
}

export const selectSelectedImageAnnotationId = (s) =>
  getSelectedImageAnnotationId(s.selection.selectedItems);

// Same payload as a 2D click on the photo (InteractionLayer).
export function buildImageAnnotationSelectionItem(a) {
  return {
    id: a.id,
    nodeId: a.id,
    type: "NODE",
    nodeType: "ANNOTATION",
    annotationType: "IMAGE",
    listingId: a.listingId,
    annotationTemplateId: a.annotationTemplateId,
    partId: null,
    partType: null,
  };
}

export function isImageAnnotationVeiled(id, selectedImageId) {
  return selectedImageId != null && id !== selectedImageId;
}
