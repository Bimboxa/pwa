import { nanoid } from "nanoid";

import db from "App/db/db";

// Picking mode: one click on an annotation links it to the armed work
// package (moving it out of another package of the listing), a second click
// unlinks it. Returns "linked" | "unlinked".
export default async function toggleAnnotationWorkPackageLinkService({
  workPackage,
  annotationId,
}) {
  return db.transaction("rw", db.relsWorkPackageAnnotation, async () => {
    const rels = (
      await db.relsWorkPackageAnnotation
        .where("annotationId")
        .equals(annotationId)
        .toArray()
    ).filter((r) => !r.deletedAt && r.listingId === workPackage.listingId);

    const here = rels.filter((r) => r.workPackageId === workPackage.id);
    if (here.length > 0) {
      await db.relsWorkPackageAnnotation.bulkDelete(here.map((r) => r.id));
      return "unlinked";
    }
    if (rels.length > 0)
      await db.relsWorkPackageAnnotation.bulkDelete(rels.map((r) => r.id));
    await db.relsWorkPackageAnnotation.add({
      id: nanoid(),
      projectId: workPackage.projectId,
      scopeId: workPackage.scopeId,
      annotationId,
      workPackageId: workPackage.id,
      listingId: workPackage.listingId,
    });
    return "linked";
  });
}
