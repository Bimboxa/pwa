import { useCallback } from "react";
import db from "App/db/db";

/**
 * Bulk delete multiple points from an annotation.
 * Reads the annotation directly from DB (raw ratio coordinates),
 * removes point references, then deletes orphaned points from the DB.
 */
export default function useDeletePoints() {
  const deletePoints = useCallback(
    async ({ pointIds, annotationId, annotations }) => {
      if (!pointIds?.length || !annotationId) return;

      const pointIdSet = new Set(pointIds);

      // 1. Read the annotation directly from DB to get raw data (ratio coords)
      const dbAnnotation = await db.annotations.get(annotationId);
      if (!dbAnnotation) {
        console.warn(
          `[useDeletePoints] Annotation ${annotationId} not found in DB.`
        );
        return;
      }

      const newPoints = (dbAnnotation.points || []).filter(
        (pt) => !pointIdSet.has(pt.id)
      );
      const newCuts = (dbAnnotation.cuts || []).map((cut) => ({
        ...cut,
        points: (cut.points || []).filter((pt) => !pointIdSet.has(pt.id)),
      }));

      await db.annotations.update(annotationId, {
        points: newPoints,
        cuts: newCuts,
      });

      console.log(
        `[useDeletePoints] Removed ${pointIds.length} point(s) from annotation ${annotationId}.`
      );

      // 2. Check for orphaned points and delete them in bulk
      const otherAnnotations = (annotations || []).filter(
        (a) => a.id !== annotationId
      );

      const orphanPointIds = pointIds.filter((pointId) => {
        return !otherAnnotations.some((ann) => {
          const inMain = ann.points?.some((pt) => pt.id === pointId);
          const inCuts = ann.cuts?.some((cut) =>
            cut.points?.some((pt) => pt.id === pointId)
          );
          return inMain || inCuts;
        });
      });

      if (orphanPointIds.length > 0) {
        console.log(
          `[useDeletePoints] Deleting ${orphanPointIds.length} orphan point(s) from DB.`
        );
        await db.points.bulkDelete(orphanPointIds);
      }
    },
    []
  );

  return deletePoints;
}
