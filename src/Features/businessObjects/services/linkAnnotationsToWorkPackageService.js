import { nanoid } from "nanoid";

import db from "App/db/db";

// Links annotations to a work package. The packages of a listing partition
// the drawing: an annotation already linked to ANOTHER package of the same
// listing is moved (its rel soft-deleted, "replaced"); an annotation already
// in this package is skipped. Returns {created, replaced}.
export default async function linkAnnotationsToWorkPackageService({
  workPackage,
  annotationIds,
}) {
  if (!workPackage?.id || !annotationIds?.length)
    return { created: [], replaced: 0 };
  const ids = [...new Set(annotationIds)];

  return db.transaction("rw", db.relsWorkPackageAnnotation, async () => {
    const existing = (
      await db.relsWorkPackageAnnotation
        .where("annotationId")
        .anyOf(ids)
        .toArray()
    ).filter((r) => !r.deletedAt && r.listingId === workPackage.listingId);

    const alreadyHere = new Set(
      existing
        .filter((r) => r.workPackageId === workPackage.id)
        .map((r) => r.annotationId)
    );
    const toReplace = existing.filter(
      (r) => r.workPackageId !== workPackage.id
    );
    if (toReplace.length > 0)
      await db.relsWorkPackageAnnotation.bulkDelete(toReplace.map((r) => r.id));

    const created = ids
      .filter((annotationId) => !alreadyHere.has(annotationId))
      .map((annotationId) => ({
        id: nanoid(),
        projectId: workPackage.projectId,
        scopeId: workPackage.scopeId,
        annotationId,
        workPackageId: workPackage.id,
        listingId: workPackage.listingId,
      }));
    if (created.length > 0) await db.relsWorkPackageAnnotation.bulkAdd(created);
    return { created, replaced: toReplace.length };
  });
}
