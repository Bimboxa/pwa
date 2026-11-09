import db from "App/db/db";

// Removes profile lines from an annotation's `profileLines` sequence and
// drops the db.points they referenced (heights live inline on the remaining
// refs, so nothing to un-bake).
//
//   - { annotationId, indices: [i, ...] } → delete those lines
//   - { annotationId }                     → delete ALL lines
//
// `skipUndo`: the removal is a cascade recomputed from another row (the
// source drawing was deleted — useProfileLinesSourceSync) and must not land
// on the undo stack (tx.skipUndo, see undoManager).
export default async function deleteProfileLinesService({
  annotationId,
  indices = null,
  skipUndo = false,
} = {}) {
  const ann = await db.annotations.get(annotationId);
  if (!ann) return false;

  const profileLines = Array.isArray(ann.profileLines) ? ann.profileLines : [];
  const drop = indices == null ? null : new Set(indices);
  const toDelete = profileLines.filter((_, i) => drop == null || drop.has(i));
  if (!toDelete.length) return false;
  const remaining = profileLines.filter((_, i) => drop != null && !drop.has(i));

  const pointIds = toDelete
    .flatMap((l) => (l?.points || []).map((p) => p?.pointId))
    .filter(Boolean);

  await db.transaction("rw", db.points, db.annotations, async (tx) => {
    if (skipUndo) tx.skipUndo = true;
    if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
    await db.annotations.update(annotationId, { profileLines: remaining });
  });
  return true;
}
