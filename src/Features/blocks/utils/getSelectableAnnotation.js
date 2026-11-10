// What a list row stands for on the plan.
//
// The quantity lists may hold VIRTUAL rows — one per (block instance, member
// of its block), see expandBlockInstancesForQties. Such a row is no db row:
// selecting / locating it means selecting its INSTANCE. Any other annotation
// is returned as is.
//
// Returns a minimal annotation-like object for the instance: {id, type,
// baseMapId, listingId, annotationTemplateId, x, y} (x, y: its insertion
// point in host pixels — what the panels zoom to).
// Pure: node-testable.
export function isBlockVirtualRow(annotation) {
  return Boolean(
    annotation?.isBlockInstanceMember && annotation?._blockInstanceId
  );
}

export default function getSelectableAnnotation(annotation) {
  if (!isBlockVirtualRow(annotation)) return annotation;
  return {
    id: annotation._blockInstanceId,
    type: "BLOCK_INSTANCE",
    baseMapId: annotation.baseMapId,
    listingId: null,
    annotationTemplateId: undefined,
    ...(Number.isFinite(annotation._blockInstanceAnchorX) &&
    Number.isFinite(annotation._blockInstanceAnchorY)
      ? {
          x: annotation._blockInstanceAnchorX,
          y: annotation._blockInstanceAnchorY,
        }
      : {}),
  };
}
