import { nanoid } from "nanoid";

import db from "App/db/db";

// Links annotations to a business object. N-N: rels to other objects are left
// untouched (unlike the one-zone-per-zoning replace rule). Invariant: at most
// ONE live rel per (annotationId, businessObjectId) pair — existing pairs are
// skipped. Returns the created rels.
export default async function linkAnnotationsToBusinessObjectService({
  businessObject,
  annotationIds,
}) {
  if (!businessObject?.id || !annotationIds?.length) return [];

  return db.transaction("rw", db.relsBusinessObjectAnnotation, async () => {
    const existingRels = (
      await db.relsBusinessObjectAnnotation
        .where("businessObjectId")
        .equals(businessObject.id)
        .toArray()
    ).filter((r) => !r.deletedAt);
    const linkedAnnotationIds = new Set(
      existingRels.map((r) => r.annotationId)
    );

    const newRels = [...new Set(annotationIds)]
      .filter((annotationId) => !linkedAnnotationIds.has(annotationId))
      .map((annotationId) => ({
        id: nanoid(),
        projectId: businessObject.projectId,
        scopeId: businessObject.scopeId,
        annotationId,
        businessObjectId: businessObject.id,
        listingId: businessObject.listingId,
      }));

    if (newRels.length > 0) {
      await db.relsBusinessObjectAnnotation.bulkAdd(newRels);
    }
    return newRels;
  });
}
