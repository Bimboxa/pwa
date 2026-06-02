import db from "App/db/db";

// Deletes guideLine(s) from an annotation's ordered `guideLines` sequence and
// drops the db.points they referenced.
//
//   - { annotationId, index }  → delete that single guideLine (re-sequencing is
//     automatic: heights are recomputed from the remaining lines at resolve).
//   - { annotationId }         → delete ALL guideLines.
//
// offsetTop is derived at resolve time, so removing guideLines is enough to
// flatten the surface — nothing to un-bake.
export default function useDeleteGuideLine() {
  return async ({ annotationId, index } = {}) => {
    const ann = await db.annotations.get(annotationId);
    if (!ann) return;

    const guideLines = Array.isArray(ann.guideLines) ? ann.guideLines : [];
    let toDelete;
    let remaining;
    if (index == null) {
      toDelete = guideLines;
      remaining = [];
    } else {
      if (!guideLines[index]) return;
      toDelete = [guideLines[index]];
      remaining = guideLines.filter((_, i) => i !== index);
    }

    const pointIds = toDelete
      .flatMap((g) => (g?.points || []).map((p) => p.pointId))
      .filter(Boolean);

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (pointIds.length > 0) await db.points.bulkDelete(pointIds);
      await db.annotations.update(annotationId, { guideLines: remaining });
    });
  };
}
