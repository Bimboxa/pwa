import db from "App/db/db";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";

// Soft-delete points on the given base maps that no *live* annotation
// references any more — the incremental counterpart of
// purgeDeletedAnnotationsService, meant to be called right after an annotation
// is deleted or redrawn so orphaned points don't pile up as live rows.
//
// Points are shared between annotations, so a point is only dropped when NO
// surviving live annotation on those base maps still references it (checked via
// the shared collectReferencedPointIds — the same definition the read path
// uses, so we never soft-delete a point the renderer still needs).
//
// `candidatePointIds` (a Set, optional) restricts the check to specific points
// — e.g. those referenced by the just-deleted annotation — so the common case
// (delete a few annotations) avoids scanning the whole points table. Omit it to
// sweep every point on the base maps (heavier; use after bulk redraws).
//
// Soft delete (via the middleware) is intentional: reads already ignore these
// (they fetch only referenced points), and "Purger les suppressions" reclaims
// the space. Best-effort by design — callers should not let a failure here
// abort the annotation mutation.
export default async function softDeleteOrphanPoints({
  baseMapIds,
  candidatePointIds,
}) {
  const bmIds = [...new Set((baseMapIds || []).filter(Boolean))];
  if (bmIds.length === 0) return { softDeleted: 0 };

  const liveAnnotations = (
    await db.annotations.where("baseMapId").anyOf(bmIds).toArray()
  ).filter((a) => a && !a.deletedAt);
  const stillReferenced = collectReferencedPointIds(liveAnnotations);

  let orphanIds;
  if (candidatePointIds) {
    orphanIds = [...candidatePointIds].filter(
      (id) => !stillReferenced.has(id)
    );
  } else {
    const bmPoints = await db.points
      .where("baseMapId")
      .anyOf(bmIds)
      .toArray();
    orphanIds = bmPoints
      .filter((p) => !p.deletedAt && !stillReferenced.has(p.id))
      .map((p) => p.id);
  }

  if (orphanIds.length > 0) {
    await db.points.bulkDelete(orphanIds); // soft-delete via middleware
  }
  return { softDeleted: orphanIds.length };
}
