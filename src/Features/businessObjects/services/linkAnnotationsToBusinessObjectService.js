import db from "App/db/db";

import getBusinessObjectLinkWrites from "../utils/getBusinessObjectLinkWrites";
import isSingleObjectPerAnnotationListing from "../utils/isSingleObjectPerAnnotationListing";
import {
  getExcludedAnnotationIds,
  removeExcludedAnnotationIds,
} from "../utils/excludedAnnotationIds";

// Links annotations to a business object. N-N by default: rels to other
// objects are left untouched. Exclusive listings (one object per annotation,
// e.g. the locations — utils/isSingleObjectPerAnnotationListing) follow the
// one-zone-per-zoning replace rule instead: the plain rels to the other
// objects of the SAME listing are soft-deleted. Invariant: at most ONE live
// rel per (annotationId, businessObjectId) pair — existing pairs are skipped.
// Linking also lifts the object's exclusions of these annotations ("Lien par
// modèle" exclusions, utils/excludedAnnotationIds): a rel and an exclusion
// never coexist on a pair.
// Returns the created rels.
export default async function linkAnnotationsToBusinessObjectService({
  businessObject,
  annotationIds,
}) {
  if (!businessObject?.id || !annotationIds?.length) return [];

  return db.transaction(
    "rw",
    db.relsBusinessObjectAnnotation,
    db.listings,
    db.businessObjects,
    async () => {
      const current = await db.businessObjects.get(businessObject.id);
      const excluded = getExcludedAnnotationIds(current);
      if (excluded.some((id) => annotationIds.includes(id))) {
        await db.businessObjects.update(businessObject.id, {
          excludedAnnotationIds: removeExcludedAnnotationIds(
            current,
            annotationIds
          ),
        });
      }

      const listing = await db.listings.get(businessObject.listingId);
      const listingRels = (
        await db.relsBusinessObjectAnnotation
          .where("annotationId")
          .anyOf([...new Set(annotationIds)])
          .toArray()
      ).filter((r) => !r.deletedAt && r.listingId === businessObject.listingId);

      const { relsToAdd, relIdsToDelete } = getBusinessObjectLinkWrites({
        businessObject,
        annotationIds,
        listingRels,
        isExclusive: isSingleObjectPerAnnotationListing(listing),
      });

      if (relIdsToDelete.length > 0) {
        // soft-delete middleware sets deletedAt
        await db.relsBusinessObjectAnnotation.bulkDelete(relIdsToDelete);
      }
      if (relsToAdd.length > 0) {
        await db.relsBusinessObjectAnnotation.bulkAdd(relsToAdd);
      }
      return relsToAdd;
    }
  );
}
