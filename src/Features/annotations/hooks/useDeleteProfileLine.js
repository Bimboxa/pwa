import db from "App/db/db";

// Deletes profileLine(s) from an annotation's `profileLines` sequence and
// drops the db.points they referenced.
//
//   - { annotationId, index }  → delete that single profile line.
//   - { annotationId }         → delete ALL profile lines.
//
// Heights live inline on the remaining refs, so removing a profile line is
// enough to flatten the shell — nothing to un-bake.
export default function useDeleteProfileLine() {
  return async ({ annotationId, index } = {}) => {
    const ann = await db.annotations.get(annotationId);
    if (!ann) return;

    const profileLines = Array.isArray(ann.profileLines)
      ? ann.profileLines
      : [];
    let toDelete;
    let remaining;
    if (index == null) {
      toDelete = profileLines;
      remaining = [];
    } else {
      if (!profileLines[index]) return;
      toDelete = [profileLines[index]];
      remaining = profileLines.filter((_, i) => i !== index);
    }

    const pointIds = toDelete
      .flatMap((l) => (l?.points || []).map((p) => p.pointId))
      .filter(Boolean);

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
      await db.annotations.update(annotationId, {
        profileLines: remaining,
      });
    });
  };
}
