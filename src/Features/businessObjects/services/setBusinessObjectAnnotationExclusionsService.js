import db from "App/db/db";

import {
  addExcludedAnnotationIds,
  removeExcludedAnnotationIds,
} from "../utils/excludedAnnotationIds";

// Excludes / re-includes annotations of a business object's "Lien par
// modèle" (businessObject.excludedAnnotationIds, see
// utils/excludedAnnotationIds). Excluding also soft-deletes the live rels of
// the (annotation, object) pairs: a rel and an exclusion on the same pair
// must not coexist (the rel would keep the annotation counted).
//
// The object row is re-read inside the transaction so two quick clicks
// cannot clobber each other's array. Returns {changedIds, deletedRelIds};
// the caller dispatches triggerBusinessObjectsUpdate (and the rels trigger
// when deletedRelIds is not empty).
export default async function setBusinessObjectAnnotationExclusionsService({
  businessObject,
  annotationIds,
  excluded,
}) {
  const ids = [...new Set((annotationIds ?? []).filter(Boolean))];
  if (!businessObject?.id || ids.length === 0)
    return { changedIds: [], deletedRelIds: [] };

  return db.transaction(
    "rw",
    db.businessObjects,
    db.relsBusinessObjectAnnotation,
    async () => {
      const current = await db.businessObjects.get(businessObject.id);
      if (!current || current.deletedAt)
        return { changedIds: [], deletedRelIds: [] };

      const before = new Set(current.excludedAnnotationIds ?? []);
      const next = excluded
        ? addExcludedAnnotationIds(current, ids)
        : removeExcludedAnnotationIds(current, ids);
      const changedIds = ids.filter(
        (id) => before.has(id) !== Boolean(excluded)
      );

      let deletedRelIds = [];
      if (excluded) {
        const rels = (
          await db.relsBusinessObjectAnnotation
            .where("annotationId")
            .anyOf(ids)
            .toArray()
        ).filter(
          (r) => !r.deletedAt && r.businessObjectId === businessObject.id
        );
        deletedRelIds = rels.map((r) => r.id);
        if (deletedRelIds.length > 0) {
          // soft-delete middleware sets deletedAt
          await db.relsBusinessObjectAnnotation.bulkDelete(deletedRelIds);
        }
      }

      if (changedIds.length > 0) {
        await db.businessObjects.update(businessObject.id, {
          excludedAnnotationIds: next,
        });
      }
      return { changedIds, deletedRelIds };
    }
  );
}
