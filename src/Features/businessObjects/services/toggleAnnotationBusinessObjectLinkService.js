import db from "App/db/db";

import getBusinessObjectLinkWrites from "../utils/getBusinessObjectLinkWrites";
import isSingleObjectPerAnnotationListing from "../utils/isSingleObjectPerAnnotationListing";

// Picking mode: one click on an annotation links it to the armed business
// object, a second click unlinks it. Linking follows the rule of
// linkAnnotationsToBusinessObjectService (exclusive listings replace the
// link to the other objects of the listing; the main annotation of another
// object of the listing is left alone).
// Returns "linked" | "unlinked" | "skipped".
export default async function toggleAnnotationBusinessObjectLinkService({
  businessObject,
  annotationId,
}) {
  return db.transaction(
    "rw",
    db.relsBusinessObjectAnnotation,
    db.listings,
    async () => {
      const listingRels = (
        await db.relsBusinessObjectAnnotation
          .where("annotationId")
          .equals(annotationId)
          .toArray()
      ).filter((r) => !r.deletedAt && r.listingId === businessObject.listingId);
      const existingRels = listingRels.filter(
        (r) => r.businessObjectId === businessObject.id
      );

      if (existingRels.length > 0) {
        // soft-delete middleware sets deletedAt
        await db.relsBusinessObjectAnnotation.bulkDelete(
          existingRels.map((r) => r.id)
        );
        return "unlinked";
      }

      const listing = await db.listings.get(businessObject.listingId);
      const { relsToAdd, relIdsToDelete } = getBusinessObjectLinkWrites({
        businessObject,
        annotationIds: [annotationId],
        listingRels,
        isExclusive: isSingleObjectPerAnnotationListing(listing),
      });
      if (relsToAdd.length === 0) return "skipped";

      if (relIdsToDelete.length > 0) {
        await db.relsBusinessObjectAnnotation.bulkDelete(relIdsToDelete);
      }
      await db.relsBusinessObjectAnnotation.bulkAdd(relsToAdd);
      return "linked";
    }
  );
}
