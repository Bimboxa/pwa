import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

// Commit a localized-repair proposal computed by buildRepairProposal.
//
// SPLIT  → untangle a self-crossing outline: the largest loop is written back to
//          the original annotation, every other loop becomes a new annotation.
// L / T  → write the merged outer ring to the largest concerned annotation
//          (as a closed POLYLINE outline) and soft-delete the absorbed ones.
// SMOOTH → replace the points of each concerned annotation in place.
//
// Point coordinates are stored in db.points normalized to [0..1] (see
// docs/annotations/POINTS_STORAGE.md). We always mint fresh point ids and never
// write inline x/y onto annotation.points — same pattern as useCleanSegments.
export default function useCommitLocalizedRepair() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const deleteAnnotations = useDeleteAnnotations();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  return async ({ plan }) => {
    if (!plan) return;

    const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
    const width = imageSize?.width || 1;
    const height = imageSize?.height || 1;

    const pointsToBulkAdd = [];
    const makeRefs = (pxPoints, pProjectId, pBaseMapId) =>
      pxPoints.map((p) => {
        const id = nanoid();
        pointsToBulkAdd.push({
          id,
          x: p.x / width,
          y: p.y / height,
          projectId: pProjectId,
          baseMapId: pBaseMapId,
        });
        return { id, type: p.type || "square" };
      });

    // ── SPLIT: untangle a self-crossing outline into separate annotations ──
    if (plan.repairType === "SPLIT" && Array.isArray(plan.winnerLoopPx)) {
      if (plan.winnerLoopPx.length < 3) return;
      const source = await db.annotations.get(plan.winnerId);
      if (!source) return;

      const winnerPoints = makeRefs(
        plan.winnerLoopPx,
        plan.winnerProjectId ?? projectId,
        plan.winnerBaseMapId
      );

      // Clone the source's template fields onto each new loop (drop geometry +
      // identity fields so they get fresh ones).
      const tmpl = { ...source };
      ["id", "points", "cuts", "entity", "createdAt", "updatedAt"].forEach(
        (k) => delete tmpl[k]
      );
      const newAnnotations = (plan.newLoops || [])
        .filter((nl) => Array.isArray(nl.loopPx) && nl.loopPx.length >= 3)
        .map((nl) => ({
          ...tmpl,
          id: nanoid(),
          closeLine: true,
          points: makeRefs(
            nl.loopPx,
            plan.winnerProjectId ?? projectId,
            plan.winnerBaseMapId
          ),
        }));

      const mappingRels = await db.relAnnotationMappingCategory
        .where("annotationId")
        .equals(plan.winnerId)
        .toArray();
      const newRels = newAnnotations.flatMap((ann) =>
        mappingRels.map((mc) => ({
          ...mc,
          id: nanoid(),
          annotationId: ann.id,
        }))
      );

      await db.transaction(
        "rw",
        [db.annotations, db.points, db.listings, db.relAnnotationMappingCategory],
        async () => {
          if (pointsToBulkAdd.length > 0)
            await db.points.bulkAdd(pointsToBulkAdd);
          await db.annotations.update(plan.winnerId, {
            points: winnerPoints,
            closeLine: true,
          });
          if (newAnnotations.length > 0)
            await db.annotations.bulkAdd(newAnnotations);
          if (newRels.length > 0)
            await db.relAnnotationMappingCategory.bulkAdd(newRels);

          // Keep the listing's sortedAnnotationIds in sync.
          const listing = source.listingId
            ? await db.listings.get(source.listingId)
            : null;
          if (listing?.sortedAnnotationIds) {
            await db.listings.update(source.listingId, {
              sortedAnnotationIds: [
                ...listing.sortedAnnotationIds,
                ...newAnnotations.map((a) => a.id),
              ],
            });
          }
        }
      );

      dispatch(triggerAnnotationsUpdate());
      return;
    }

    // ── In-place points replacement, no deletes (SMOOTH + centerline L/T) ──
    if (Array.isArray(plan.updates) && plan.updates.length > 0) {
      const updates = plan.updates
        .filter((u) => Array.isArray(u.pointsPx) && u.pointsPx.length >= 2)
        .map((u) => ({
          id: u.id,
          points: makeRefs(u.pointsPx, u.projectId ?? projectId, u.baseMapId),
        }));
      if (updates.length === 0) return;

      await db.transaction("rw", [db.annotations, db.points], async () => {
        if (pointsToBulkAdd.length > 0)
          await db.points.bulkAdd(pointsToBulkAdd);
        await Promise.all(
          updates.map((u) => db.annotations.update(u.id, { points: u.points }))
        );
      });

      dispatch(triggerAnnotationsUpdate());
      return;
    }

    // ── L / T: merged outline into the winner, delete the absorbed ────────
    if (!Array.isArray(plan.mergedRingPx) || plan.mergedRingPx.length < 3)
      return;

    const points = makeRefs(
      plan.mergedRingPx,
      plan.winnerProjectId ?? projectId,
      plan.winnerBaseMapId
    );

    await db.transaction("rw", [db.annotations, db.points], async () => {
      if (pointsToBulkAdd.length > 0) await db.points.bulkAdd(pointsToBulkAdd);
      await db.annotations.update(plan.winnerId, {
        points,
        closeLine: true,
      });
    });

    // Soft-delete the absorbed annotations OUTSIDE the transaction —
    // useDeleteAnnotations runs its own transaction over extra tables.
    if (plan.deleteIds?.length > 0) {
      await deleteAnnotations(plan.deleteIds);
    }

    dispatch(triggerAnnotationsUpdate());
  };
}
