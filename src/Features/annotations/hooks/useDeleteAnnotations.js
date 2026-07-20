import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import db from "App/db/db";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import softDeleteOrphanPoints from "Features/annotations/services/softDeleteOrphanPoints";

export default function useDeleteAnnotations() {
  const dispatch = useDispatch();

  return async (annotationIds) => {
    if (!annotationIds || annotationIds.length === 0) return;

    // 1. Fetch all annotations in a single call
    const annotations = await db.annotations.bulkGet(annotationIds);
    const validAnnotations = annotations.filter(Boolean);

    if (validAnnotations.length === 0) return;

    const idsToDelete = validAnnotations.map((a) => a.id);
    const idsToDeleteSet = new Set(idsToDelete);

    // 1a. Cascade to mesh cells: when a parent annotation is deleted, its mesh
    // cells ("mailles") are deleted too. Pull the child cell annotations and
    // fold them into the deletion set so the rest of the cleanup (listings,
    // etc.) applies to them as well.
    const meshRelsAsParent = await db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .anyOf(idsToDelete)
      .toArray();
    const childCellIds = [
      ...new Set(
        meshRelsAsParent
          .filter((r) => !r.deletedAt)
          .map((r) => r.meshCellAnnotationId)
          .filter((id) => !idsToDeleteSet.has(id))
      ),
    ];
    if (childCellIds.length > 0) {
      const childCells = (await db.annotations.bulkGet(childCellIds)).filter(
        (a) => a && !a.deletedAt
      );
      for (const c of childCells) {
        validAnnotations.push(c);
        idsToDelete.push(c.id);
        idsToDeleteSet.add(c.id);
      }
    }

    // 1a-bis. Collect mesh relations touching any deleted annotation (as parent
    // or as cell) so the relation rows are soft-deleted too.
    const meshRelsAsCell = await db.relAnnotationMeshCells
      .where("meshCellAnnotationId")
      .anyOf(idsToDelete)
      .toArray();
    const meshRelIds = [
      ...new Set(
        [...meshRelsAsParent, ...meshRelsAsCell]
          .filter((r) => !r.deletedAt)
          .map((r) => r.id)
      ),
    ];

    // 1b. Cascade: collect subtraction relations where a deleted annotation is
    // either the source (carved polygon) or the target (subtracted shape).
    const [relSrc, relTgt] = await Promise.all([
      db.relAnnotationSubtractions
        .where("sourceAnnotationId")
        .anyOf(idsToDelete)
        .toArray(),
      db.relAnnotationSubtractions
        .where("targetAnnotationId")
        .anyOf(idsToDelete)
        .toArray(),
    ]);
    const subtractionRelIds = [
      ...new Set(
        [...relSrc, ...relTgt].filter((r) => !r.deletedAt).map((r) => r.id)
      ),
    ];

    // 1c. Cascade: collect opening relations where a deleted annotation is
    // either the host wall or the opening itself.
    const [openingRelsAsHost, openingRelsAsOpening] = await Promise.all([
      db.relAnnotationOpenings
        .where("hostAnnotationId")
        .anyOf(idsToDelete)
        .toArray(),
      db.relAnnotationOpenings
        .where("openingAnnotationId")
        .anyOf(idsToDelete)
        .toArray(),
    ]);
    const openingRelIds = [
      ...new Set(
        [...openingRelsAsHost, ...openingRelsAsOpening]
          .filter((r) => !r.deletedAt)
          .map((r) => r.id)
      ),
    ];

    // 2. Determine which annotations are cutHosts (batch template lookup)
    const uniqueTemplateIds = [
      ...new Set(
        validAnnotations.map((a) => a.annotationTemplateId).filter(Boolean)
      ),
    ];
    const templates =
      uniqueTemplateIds.length > 0
        ? await db.annotationTemplates.bulkGet(uniqueTemplateIds)
        : [];
    const cutHostTemplateIds = new Set(
      templates.filter((t) => t?.cutHost === true).map((t) => t.id)
    );

    const cutHostIds = new Set(
      validAnnotations
        .filter(
          (a) =>
            a.cutHost === true ||
            (a.annotationTemplateId &&
              cutHostTemplateIds.has(a.annotationTemplateId))
        )
        .map((a) => a.id)
    );

    // 3. If any cutHosts, find all annotations that reference them (single query)
    let cutUpdates = [];
    if (cutHostIds.size > 0) {
      const uniqueBaseMapIds = [
        ...new Set(
          validAnnotations
            .filter((a) => cutHostIds.has(a.id) && a.baseMapId)
            .map((a) => a.baseMapId)
        ),
      ];

      if (uniqueBaseMapIds.length > 0) {
        const baseMapAnnotations = await db.annotations
          .where("baseMapId")
          .anyOf(uniqueBaseMapIds)
          .toArray();

        for (const ann of baseMapAnnotations) {
          if (!ann.cuts || !Array.isArray(ann.cuts) || ann.cuts.length === 0)
            continue;
          // Skip annotations that are themselves being deleted
          if (idsToDeleteSet.has(ann.id)) continue;

          const updatedCuts = ann.cuts.filter(
            (cut) => !cutHostIds.has(cut.cutHostId)
          );

          if (updatedCuts.length !== ann.cuts.length) {
            cutUpdates.push({
              id: ann.id,
              cuts: updatedCuts.length > 0 ? updatedCuts : undefined,
            });
          }
        }
      }
    }

    // 4. Group by listingId to batch listing updates
    const annotationsByListing = new Map();
    for (const a of validAnnotations) {
      if (a.listingId && !a.isBaseMapAnnotation) {
        if (!annotationsByListing.has(a.listingId)) {
          annotationsByListing.set(a.listingId, []);
        }
        annotationsByListing.get(a.listingId).push(a.id);
      }
    }

    const listingIds = [...annotationsByListing.keys()];
    const listings =
      listingIds.length > 0 ? await db.listings.bulkGet(listingIds) : [];
    const listingUpdates = [];
    for (const listing of listings) {
      if (!listing?.sortedAnnotationIds) continue;
      const removedIds = annotationsByListing.get(listing.id);
      const removedSet = new Set(removedIds);
      const filtered = listing.sortedAnnotationIds.filter(
        (id) => !removedSet.has(id)
      );
      if (filtered.length !== listing.sortedAnnotationIds.length) {
        listingUpdates.push({
          id: listing.id,
          sortedAnnotationIds: filtered,
        });
      }
    }

    // 5. Execute all writes in a single transaction
    await db.transaction(
      "rw",
      [
        db.annotations,
        db.listings,
        db.relAnnotationSubtractions,
        db.relAnnotationMeshCells,
        db.relAnnotationOpenings,
      ],
      async () => {
        // Cascade soft-delete subtraction relations
        if (subtractionRelIds.length > 0) {
          await db.relAnnotationSubtractions.bulkDelete(subtractionRelIds);
        }

        // Cascade soft-delete mesh relations
        if (meshRelIds.length > 0) {
          await db.relAnnotationMeshCells.bulkDelete(meshRelIds);
        }

        // Cascade soft-delete opening relations
        if (openingRelIds.length > 0) {
          await db.relAnnotationOpenings.bulkDelete(openingRelIds);
        }

        // Batch cuts-cleanup updates
        if (cutUpdates.length > 0) {
          await Promise.all(
            cutUpdates.map((u) => db.annotations.update(u.id, { cuts: u.cuts }))
          );
        }

        // Batch listing updates (one per unique listing)
        if (listingUpdates.length > 0) {
          await Promise.all(
            listingUpdates.map((u) =>
              db.listings.update(u.id, {
                sortedAnnotationIds: u.sortedAnnotationIds,
              })
            )
          );
        }

        // Soft-delete all annotations (middleware handles deletedAt, undo, etc.)
        await db.annotations.bulkDelete(idsToDelete);
      }
    );

    // 5b. Best-effort cascade: soft-delete points orphaned by this deletion —
    // those referenced by the just-deleted annotations that no surviving live
    // annotation still uses. Kept OUTSIDE the transaction above so an edge
    // failure here (e.g. ownership on a point) can never roll back the
    // annotation deletion; "Purger les suppressions" is the backstop.
    try {
      const candidatePointIds = collectReferencedPointIds(validAnnotations);
      if (candidatePointIds.size > 0) {
        await softDeleteOrphanPoints({
          baseMapIds: validAnnotations.map((a) => a.baseMapId),
          candidatePointIds,
        });
      }
    } catch (e) {
      console.error("[useDeleteAnnotations] orphan point cleanup failed", e);
    }

    // 6. Single Redux dispatch
    dispatch(triggerAnnotationsUpdate());
  };
}
