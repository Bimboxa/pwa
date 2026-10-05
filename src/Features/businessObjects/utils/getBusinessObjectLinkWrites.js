import { nanoid } from "nanoid";

// Writes linking `annotationIds` to `businessObject` (plain rels). Pure: the
// caller reads `listingRels` and applies the writes in its own transaction.
//
// listingRels: the LIVE rels of those annotations towards the objects of
// businessObject.listingId.
// isExclusive: the listing accepts one object per annotation
// (utils/isSingleObjectPerAnnotationListing) — the plain rels towards the
// other objects of the listing are replaced, and the MAIN annotations of the
// listing (the objects' own geometry) are never linked to another object.
// Invariant in both modes: at most ONE live rel per (annotationId,
// businessObjectId) pair — existing pairs are skipped.
// => { relsToAdd, relIdsToDelete, skippedAnnotationIds }
export default function getBusinessObjectLinkWrites({
  businessObject,
  annotationIds,
  listingRels,
  isExclusive,
}) {
  const relsByAnnotationId = {};
  (listingRels ?? []).forEach((rel) => {
    if (!relsByAnnotationId[rel.annotationId])
      relsByAnnotationId[rel.annotationId] = [];
    relsByAnnotationId[rel.annotationId].push(rel);
  });

  const relsToAdd = [];
  const relIdsToDelete = [];
  const skippedAnnotationIds = [];

  [...new Set(annotationIds ?? [])].forEach((annotationId) => {
    const rels = relsByAnnotationId[annotationId] ?? [];
    const otherRels = rels.filter(
      (r) => r.businessObjectId !== businessObject.id
    );
    if (isExclusive && otherRels.some((r) => r.isMain)) {
      skippedAnnotationIds.push(annotationId);
      return;
    }
    if (isExclusive) relIdsToDelete.push(...otherRels.map((r) => r.id));
    if (rels.length === otherRels.length) {
      relsToAdd.push({
        id: nanoid(),
        projectId: businessObject.projectId,
        scopeId: businessObject.scopeId,
        annotationId,
        businessObjectId: businessObject.id,
        listingId: businessObject.listingId,
      });
    }
  });

  return { relsToAdd, relIdsToDelete, skippedAnnotationIds };
}
