import db from "App/db/db";

/**
 * Replaces a point reference in annotations with a snap target point.
 * The old point's `type` (square/circle) is preserved on the new reference.
 * The old point is deleted from DB if it becomes orphaned.
 *
 * @param {Object} params
 * @param {string} params.oldPointId - The point being dragged
 * @param {string} params.snapPointId - The snap target point to replace with
 * @param {string[]} params.affectedAnnotationIds - Annotation IDs that contain oldPointId
 * @param {Array} params.annotations - Full annotations list (for orphan check)
 */
export default async function replacePointBySnap({
  oldPointId,
  snapPointId,
  affectedAnnotationIds,
  annotations,
}) {
  try {
    const affectedAnnotations = annotations.filter((a) =>
      affectedAnnotationIds.includes(a.id)
    );

    if (affectedAnnotations.length === 0) return;

    // Helper: replace oldPointId with snapPointId in a points array, keeping the old entry's type
    const replaceInPoints = (points) =>
      points?.map((pt) =>
        pt.id === oldPointId ? { ...pt, id: snapPointId } : pt
      );

    await db.transaction("rw", db.points, db.annotations, async () => {
      // 1. Update annotations: swap point reference
      const ops = affectedAnnotations.map((ann) => {
        const updates = {};

        if (ann.points?.some((pt) => pt.id === oldPointId)) {
          updates.points = replaceInPoints(ann.points);
        }

        if (ann.cuts?.some((cut) => cut.points?.some((pt) => pt.id === oldPointId))) {
          updates.cuts = ann.cuts.map((cut) => ({
            ...cut,
            points: replaceInPoints(cut.points),
          }));
        }

        // Clear rotation metadata (moving a vertex bakes in the rotation)
        if (ann.rotation || ann.rotationCenter) {
          updates.rotation = 0;
          updates.rotationCenter = null;
        }

        return db.annotations.update(ann.id, updates);
      });

      await Promise.all(ops);

      // 2. Check if old point is now orphaned
      const modifiedIds = new Set(affectedAnnotationIds);
      const isUsedElsewhere = annotations.some((ann) => {
        if (modifiedIds.has(ann.id)) return false;
        const inMain = ann.points?.some((pt) => pt.id === oldPointId);
        const inCuts = ann.cuts?.some((cut) =>
          cut.points?.some((pt) => pt.id === oldPointId)
        );
        return inMain || inCuts;
      });

      if (!isUsedElsewhere) {
        await db.points.delete(oldPointId);
      }
    });
  } catch (error) {
    console.error("[replacePointBySnap] Error:", error);
  }
}
