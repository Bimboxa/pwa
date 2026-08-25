// Custom dataTransfer type carried by a PDF page dragged from the resources
// panel (native HTML5 DnD — the app-wide dnd-kit PointerSensor requires a
// 250 ms press-and-hold, way too much friction for page thumbnails). The 2D
// editor (InteractionLayer) accepts drops of this type and creates a DETAIL
// annotation with folio = the dropped page. Lowercase on purpose: browsers
// lowercase dataTransfer types.
export const PDF_PAGE_DRAG_MIME = "application/x-bimboxa-pdf-page";
