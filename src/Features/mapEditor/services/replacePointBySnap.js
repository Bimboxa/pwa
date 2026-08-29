import db from "App/db/db";

import { remapPointIds } from "Features/annotations/utils/remapAnnotationRefs";
import { SEGMENT_FLAG_FIELDS } from "Features/annotations/utils/segmentFlags";
import remapOpeningAnchorsForHosts from "Features/annotations/services/remapOpeningAnchorsForHosts";

/**
 * Replaces a point reference in annotations with a snap target point.
 * The old point's `type` (square/circle) is preserved on the new reference.
 * The old point is deleted from DB if it becomes orphaned.
 *
 * remapPointIds covers every ref kind (points, cuts, innerPoints, guideLines,
 * isoHeightLines, profileLines, segment-flag id arrays), and glued-opening
 * anchors follow the same id swap so the commit-time reflow keeps their
 * exact hostDistanceM.
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

    const pointIdMap = { [oldPointId]: snapPointId };
    const refFields = [
      "points",
      "cuts",
      "innerPoints",
      "guideLines",
      "isoHeightLines",
      "profileLines",
      "point",
      ...SEGMENT_FLAG_FIELDS.map(({ idField }) => idField),
    ];

    await db.transaction(
      "rw",
      db.points,
      db.annotations,
      db.relAnnotationOpenings,
      async () => {
        // 1. Update annotations: swap every point reference
        const ops = affectedAnnotations.map((ann) => {
          const remapped = { ...ann };
          remapPointIds(remapped, pointIdMap);

          const updates = {};
          for (const field of refFields) {
            if (ann[field] !== undefined) updates[field] = remapped[field];
          }

          // Clear rotation metadata (moving a vertex bakes in the rotation)
          if (ann.rotation || ann.rotationCenter) {
            updates.rotation = 0;
            updates.rotationCenter = null;
          }

          return db.annotations.update(ann.id, updates);
        });

        await Promise.all(ops);

        // 2. Glued-opening anchors on the affected hosts follow the id swap
        // (per-rel failures degrade to a stale anchor, see the service).
        await remapOpeningAnchorsForHosts({
          hostAnnotationIds: affectedAnnotationIds,
          pointIdMap,
        });

        // 3. Check if old point is now orphaned
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
      }
    );
  } catch (error) {
    console.error("[replacePointBySnap] Error:", error);
  }
}
