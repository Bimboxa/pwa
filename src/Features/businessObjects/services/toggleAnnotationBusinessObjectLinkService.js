import { nanoid } from "nanoid";

import db from "App/db/db";

// Picking mode: one click on an annotation links it to the armed business
// object, a second click unlinks it. Returns "linked" | "unlinked".
export default async function toggleAnnotationBusinessObjectLinkService({
  businessObject,
  annotationId,
}) {
  return db.transaction("rw", db.relsBusinessObjectAnnotation, async () => {
    const existingRels = (
      await db.relsBusinessObjectAnnotation
        .where("annotationId")
        .equals(annotationId)
        .toArray()
    ).filter((r) => !r.deletedAt && r.businessObjectId === businessObject.id);

    if (existingRels.length > 0) {
      // soft-delete middleware sets deletedAt
      await db.relsBusinessObjectAnnotation.bulkDelete(
        existingRels.map((r) => r.id)
      );
      return "unlinked";
    }

    await db.relsBusinessObjectAnnotation.add({
      id: nanoid(),
      projectId: businessObject.projectId,
      scopeId: businessObject.scopeId,
      annotationId,
      businessObjectId: businessObject.id,
      listingId: businessObject.listingId,
    });
    return "linked";
  });
}
