// A db.relsBusinessObjectResource row links either a highlighted zone of a
// PDF document (pageNumber + rects) or the WHOLE resource (no rects, no
// page): any resource type, see linkResourceToBusinessObjectService.
export default function isWholeResourceRel(rel) {
  return !rel?.rects?.length;
}
