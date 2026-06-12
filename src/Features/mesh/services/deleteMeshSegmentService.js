import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import db from "App/db/db";

// Delete ALL mailles of one segment of a meshed annotation: soft-delete the
// cell annotations + their relations, and drop that segment's persisted cut
// lines. POLYLINE → only the given seed segment; POLYGON → the whole mesh.
// Leaves the segment un-meshed (the parent annotation keeps its own quantity).
export default async function deleteMeshSegmentService({
  parentAnnotation,
  mode,
  seedSegmentIndex,
  dispatch,
}) {
  if (!parentAnnotation) return;
  const parentId = parentAnnotation.id;
  const isPolyline = mode === "POLYLINE";
  const seed = isPolyline
    ? Number.isInteger(seedSegmentIndex)
      ? seedSegmentIndex
      : 0
    : null;

  const rels = (
    await db.relAnnotationMeshCells
      .where("parentAnnotationId")
      .equals(parentId)
      .toArray()
  )
    .filter((r) => !r.deletedAt)
    .filter((r) => !isPolyline || r.seedSegmentIndex === seed);

  const cellIds = rels.map((r) => r.meshCellAnnotationId);
  const relIds = rels.map((r) => r.id);

  await db.transaction(
    "rw",
    [db.annotations, db.relAnnotationMeshCells],
    async () => {
      if (cellIds.length > 0) await db.annotations.bulkDelete(cellIds);
      if (relIds.length > 0) await db.relAnnotationMeshCells.bulkDelete(relIds);
      if (isPolyline) {
        const next = { ...(parentAnnotation.meshLinesBySegment ?? {}) };
        delete next[seed];
        await db.annotations.update(parentId, { meshLinesBySegment: next });
      } else {
        await db.annotations.update(parentId, { meshLines: [] });
      }
    }
  );

  dispatch?.(triggerAnnotationsUpdate());
}
