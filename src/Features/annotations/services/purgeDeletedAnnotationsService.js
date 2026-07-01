import db, { withHardDelete } from "App/db/db";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";

// Compaction ("Purger les suppressions"): hard-deletes the dead weight that
// accumulates in db.annotations / db.points and slows every useAnnotationsV2
// read (and bloats the exported scope ZIP, which is a full snapshot):
//
//   1. Soft-deleted annotations (deletedAt set) — tombstones the soft-delete
//      middleware keeps forever. Scanned on every baseMap read.
//   2. Orphan points — point rows no *live* annotation references. Points are
//      never deleted when a POLYLINE/POLYGON is redrawn or removed, so they
//      pile up as live-but-unreferenced rows.
//
// SCOPE: restricted to the CURRENT scope. Annotations/points have no scopeId,
// so — like createKrtoZip — the scope's listings are those with
// `scopeId === scopeId` plus the project's *shared* listings (no scopeId, e.g.
// baseMaps). Only rows whose listingId is in that set are deleted, so other
// scopes of the same project are left untouched.
//
// SAFETY: the "referenced" set is collected from EVERY live annotation of the
// whole project (all scopes), not just the current scope. So a point that lives
// in a shared listing but is still referenced by another scope's live
// annotation is never deleted. Points still in use — including those shared
// between annotations — are always preserved.
//
// Hard delete bypasses the soft-delete middleware (withHardDelete) and is not
// undoable — the caller must confirm with the user first.
export default async function purgeDeletedAnnotationsService({
  projectId,
  scopeId,
}) {
  if (!projectId)
    throw new Error("purgeDeletedAnnotationsService: projectId is required");
  if (!scopeId)
    throw new Error("purgeDeletedAnnotationsService: scopeId is required");

  // Listings belonging to the current scope: scoped listings + shared listings
  // (no scopeId). Mirrors createKrtoZip's `relevantListings`.
  const projectListings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();
  const scopeListingIds = new Set(
    projectListings
      .filter((l) => l.scopeId === scopeId || !l.scopeId)
      .map((l) => l.id)
  );

  const [allAnnotations, allPoints] = await Promise.all([
    db.annotations.where("projectId").equals(projectId).toArray(),
    db.points.where("projectId").equals(projectId).toArray(),
  ]);

  // Referenced set = every live annotation of the WHOLE project (all scopes),
  // so we never delete a point another scope still uses.
  const referencedPointIds = collectReferencedPointIds(
    allAnnotations.filter((a) => !a.deletedAt)
  );

  // Delete set = only rows belonging to the current scope's listings.
  const deletedAnnotationIds = allAnnotations
    .filter((a) => a.deletedAt && scopeListingIds.has(a.listingId))
    .map((a) => a.id);

  const orphanPointIds = allPoints
    .filter(
      (p) => scopeListingIds.has(p.listingId) && !referencedPointIds.has(p.id)
    )
    .map((p) => p.id);

  await withHardDelete(async () => {
    if (deletedAnnotationIds.length > 0)
      await db.annotations.bulkDelete(deletedAnnotationIds);
    if (orphanPointIds.length > 0) await db.points.bulkDelete(orphanPointIds);
  });

  return {
    purgedAnnotations: deletedAnnotationIds.length,
    purgedPoints: orphanPointIds.length,
  };
}
