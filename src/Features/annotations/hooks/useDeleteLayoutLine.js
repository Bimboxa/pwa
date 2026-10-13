import db from "App/db/db";

// Deletes layoutLine(s) ("lignes de calepinage") from an annotation's
// `layoutLines` array and drops the db.points they referenced.
//
//   - { annotationId, index }  → delete that single layoutLine
//   - { annotationId }         → delete ALL layoutLines
export default function useDeleteLayoutLine() {
  return async ({ annotationId, index } = {}) => {
    const ann = await db.annotations.get(annotationId);
    if (!ann) return;

    const layoutLines = Array.isArray(ann.layoutLines) ? ann.layoutLines : [];
    let toDelete;
    let remaining;
    if (index == null) {
      toDelete = layoutLines;
      remaining = [];
    } else {
      if (!layoutLines[index]) return;
      toDelete = [layoutLines[index]];
      remaining = layoutLines.filter((_, i) => i !== index);
    }

    const pointIds = toDelete
      .flatMap((l) => (l?.points || []).map((p) => p.pointId))
      .filter(Boolean);

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
      await db.annotations.update(annotationId, { layoutLines: remaining });
    });
  };
}
