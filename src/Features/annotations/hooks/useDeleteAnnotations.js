import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "../annotationsSlice";

import db from "App/db/db";

export default function useDeleteAnnotations() {
  const dispatch = useDispatch();

  return async (annotationIds) => {
    if (!annotationIds || annotationIds.length === 0) return;

    // 1. Fetch all annotations in a single call
    const annotations = await db.annotations.bulkGet(annotationIds);
    const validAnnotations = annotations.filter(Boolean);

    if (validAnnotations.length === 0) return;

    const idsToDelete = validAnnotations.map((a) => a.id);

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
          if (idsToDelete.includes(ann.id)) continue;

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
      [db.annotations, db.listings],
      async () => {
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

    // 6. Single Redux dispatch
    dispatch(triggerAnnotationsUpdate());
  };
}
