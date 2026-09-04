import { nanoid } from "nanoid";

import db from "App/db/db";

// Makes `annotation` the MAIN annotation of `businessObject` on the
// annotation's base map. Invariants enforced here:
// (a) at most one live isMain rel per (businessObjectId, baseMapId) — the
//     previous main annotation of this object on that base map is returned in
//     replacedMainAnnotationIds, the CALLER decides its fate (the "Localiser"
//     flow deletes it);
// (b) at most one live isMain rel per annotationId — other objects' main rels
//     on this annotation are demoted to plain links.
// The rel row denormalizes baseMapId so per-base-map lookups need no
// annotation join. Returns { rel, replacedMainAnnotationIds }.
export default async function setMainAnnotationForBusinessObjectService({
  businessObject,
  annotation,
}) {
  if (!businessObject?.id || !annotation?.id) return null;
  const baseMapId = annotation.baseMapId ?? null;

  return db.transaction("rw", db.relsBusinessObjectAnnotation, async () => {
    const objectRels = (
      await db.relsBusinessObjectAnnotation
        .where("businessObjectId")
        .equals(businessObject.id)
        .toArray()
    ).filter((r) => !r.deletedAt);

    // (a) previous main on the same base map (other annotations only)
    const replacedMainAnnotationIds = objectRels
      .filter(
        (r) =>
          r.isMain &&
          r.baseMapId === baseMapId &&
          r.annotationId !== annotation.id
      )
      .map((r) => r.annotationId);

    // (b) other objects' main rels on this annotation → plain links
    const annotationRels = (
      await db.relsBusinessObjectAnnotation
        .where("annotationId")
        .equals(annotation.id)
        .toArray()
    ).filter((r) => !r.deletedAt);
    for (const r of annotationRels) {
      if (r.isMain && r.businessObjectId !== businessObject.id) {
        await db.relsBusinessObjectAnnotation.update(r.id, { isMain: false });
      }
    }

    // promote the existing pair rel, or create it
    const existing = objectRels.find((r) => r.annotationId === annotation.id);
    let rel;
    if (existing) {
      await db.relsBusinessObjectAnnotation.update(existing.id, {
        isMain: true,
        baseMapId,
      });
      rel = { ...existing, isMain: true, baseMapId };
    } else {
      rel = {
        id: nanoid(),
        projectId: businessObject.projectId,
        scopeId: businessObject.scopeId,
        annotationId: annotation.id,
        businessObjectId: businessObject.id,
        listingId: businessObject.listingId,
        isMain: true,
        baseMapId,
      };
      await db.relsBusinessObjectAnnotation.add(rel);
    }

    return { rel, replacedMainAnnotationIds };
  });
}
