import db from "App/db/db";

// Deletes isoHeightLine(s) from an annotation's `isoHeightLines` sequence and
// drops the db.points they referenced.
//
//   - { annotationId, index }  → delete that single iso line.
//   - { annotationId }         → delete ALL iso lines.
//
// Heights are read from the remaining lines at resolve time, so removing an
// iso line is enough to flatten the surface — nothing to un-bake.
export default function useDeleteIsoHeightLine() {
  return async ({ annotationId, index } = {}) => {
    const ann = await db.annotations.get(annotationId);
    if (!ann) return;

    const isoHeightLines = Array.isArray(ann.isoHeightLines)
      ? ann.isoHeightLines
      : [];
    let toDelete;
    let remaining;
    if (index == null) {
      toDelete = isoHeightLines;
      remaining = [];
    } else {
      if (!isoHeightLines[index]) return;
      toDelete = [isoHeightLines[index]];
      remaining = isoHeightLines.filter((_, i) => i !== index);
    }

    const pointIds = toDelete
      .flatMap((l) => (l?.points || []).map((p) => p.pointId))
      .filter(Boolean);

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
      await db.annotations.update(annotationId, {
        isoHeightLines: remaining,
      });
    });
  };
}
