import { nanoid } from "nanoid";

import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import encodePhaseRels from "../utils/encodePhaseRels";

// Sets the phases of annotations in ONE batch (one transaction, one undo
// step). `indexesByAnnotationId`: Map annotationId -> Set / array of the
// indexes (in `phases`, the ordered phases of `listing`) the annotation is
// present in. Only the rows that differ are written: the live rows that no
// longer apply are soft-deleted, the missing ones added. An empty set is
// skipped (an annotation is always in at least one phase).
// `skipUndo`: the write pushes no undo entry (assignment following a
// creation — see requestPhaseAssignOnCreate).
// Returns the number of rows written.
export default async function setAnnotationsPhasesService({
  listing,
  phases,
  indexesByAnnotationId,
  skipUndo = false,
}) {
  if (!listing?.id || !phases?.length || !indexesByAnnotationId?.size) return 0;

  const targetByAnnotationId = new Map();
  indexesByAnnotationId.forEach((indexes, annotationId) => {
    const rows = encodePhaseRels(indexes, phases);
    if (annotationId && rows) targetByAnnotationId.set(annotationId, rows);
  });
  const annotationIds = [...targetByAnnotationId.keys()];
  if (annotationIds.length === 0) return 0;

  const keyOf = (r) => `${r.type}|${r.phaseId}`;

  const run = () =>
    db.transaction("rw", db.relsPhaseAnnotation, async (tx) => {
      if (skipUndo) tx.skipUndo = true;
      const existing = (
        await db.relsPhaseAnnotation
          .where("annotationId")
          .anyOf(annotationIds)
          .toArray()
      ).filter((r) => !r.deletedAt && r.listingId === listing.id);
      const existingByAnnotationId = new Map();
      existing.forEach((r) => {
        const list = existingByAnnotationId.get(r.annotationId) ?? [];
        list.push(r);
        existingByAnnotationId.set(r.annotationId, list);
      });

      const idsToDelete = [];
      const rowsToAdd = [];
      targetByAnnotationId.forEach((target, annotationId) => {
        const current = existingByAnnotationId.get(annotationId) ?? [];
        const targetKeys = new Set(target.map(keyOf));
        const keptKeys = new Set();
        current.forEach((r) => {
          const key = keyOf(r);
          // a duplicate row is dropped too
          if (targetKeys.has(key) && !keptKeys.has(key)) keptKeys.add(key);
          else idsToDelete.push(r.id);
        });
        target.forEach((r) => {
          if (keptKeys.has(keyOf(r))) return;
          rowsToAdd.push({
            id: nanoid(),
            projectId: listing.projectId,
            scopeId: listing.scopeId,
            listingId: listing.id,
            annotationId,
            phaseId: r.phaseId,
            type: r.type,
          });
        });
      });

      if (idsToDelete.length > 0)
        await db.relsPhaseAnnotation.bulkDelete(idsToDelete);
      if (rowsToAdd.length > 0) await db.relsPhaseAnnotation.bulkAdd(rowsToAdd);
      return idsToDelete.length + rowsToAdd.length;
    });

  return skipUndo ? run() : withUndoGroup(run);
}
