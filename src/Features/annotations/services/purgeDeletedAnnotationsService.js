import db, { withHardDelete, withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

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
// baseMaps). Annotations are scoped by listingId; points by the baseMapId of
// the scope's base maps (their listingId is unreliable — see below). Other
// scopes of the same project are left untouched.
//
// Also HEALS (un-tombstones) points that are still referenced by a live
// annotation but were soft-deleted — the state left behind when an annotation
// is deleted (softDeleteOrphanPoints) then brought back by a snapshot restore
// that didn't carry the point rows.
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

  // Points are scoped via their baseMapId, NOT their listingId: a point row's
  // listingId is unreliable (paste/clone paths historically omitted it) and
  // means nothing — a point belongs to a base map. BaseMaps are shared across
  // the project's scopes, which is safe here because the referenced set above
  // is collected project-wide: an orphan on a shared base map is an orphan for
  // every scope. listingId is kept as a fallback for legacy rows lacking a
  // baseMapId.
  const scopeBaseMapIds = new Set(
    (await db.baseMaps.where("projectId").equals(projectId).toArray())
      .filter((bm) => scopeListingIds.has(bm.listingId))
      .map((bm) => bm.id)
  );
  const isInScope = (p) =>
    p.baseMapId
      ? scopeBaseMapIds.has(p.baseMapId)
      : scopeListingIds.has(p.listingId);

  const orphanPointIds = allPoints
    .filter((p) => isInScope(p) && !referencedPointIds.has(p.id))
    .map((p) => p.id);

  // HEAL: points still referenced by a live annotation but carrying a
  // soft-delete tombstone (e.g. their annotation was deleted then restored
  // from a snapshot that didn't contain the point rows). The read path
  // (useAnnotationsV2) drops deletedAt points, so these refs would resolve as
  // corruptedPointIds forever — un-tombstone them. System write: the rows may
  // be owned by another user; this is a repair, not a user edit.
  const healPointIds = allPoints
    .filter((p) => p.deletedAt && referencedPointIds.has(p.id))
    .map((p) => p.id);

  // withoutUndo: a maintenance pass must not flood the undo stack (one entry
  // per healed point) — and a Ctrl+Z must not re-tombstone healed points.
  await withSystemWrite(() =>
    withoutUndo(async () => {
      if (healPointIds.length > 0) {
        await db.points
          .where("id")
          .anyOf(healPointIds)
          .modify({ deletedAt: null, deletedByUserIdMaster: null });
      }

      await withHardDelete(async () => {
        if (deletedAnnotationIds.length > 0)
          await db.annotations.bulkDelete(deletedAnnotationIds);
        if (orphanPointIds.length > 0)
          await db.points.bulkDelete(orphanPointIds);
      });
    })
  );

  return {
    purgedAnnotations: deletedAnnotationIds.length,
    purgedPoints: orphanPointIds.length,
    healedPoints: healPointIds.length,
  };
}
