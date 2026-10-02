import db from "App/db/db";
import { withUndoGroup } from "App/db/undoManager";

import { filterMeshPaintsWritableHere } from "Features/meshPaint/services/meshPaintWriteGuard";

/**
 * Removes painted mesh parts (user action: « Supprimer » of a painted part
 * in the template detail list). Soft delete through the middleware, ONE undo
 * step.
 *
 * Throws what the db guards throw (ReadOnlyScopeError,
 * LinkedListingReadOnlyError): callers hide the action in those contexts.
 *
 * @param {{ids: string[]}} params
 * @returns {Promise<{deletedCount: number}>}
 */
export default async function deleteMeshPaintsService({ ids }) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))];
  if (uniqueIds.length === 0) return { deletedCount: 0 };

  await withUndoGroup(() => db.meshPaints.bulkDelete(uniqueIds));

  return { deletedCount: uniqueIds.length };
}

// --- cascade helpers (live rows only) ---

const isLive = (row) => row && !row.deletedAt;

// Ids of the live paints hosted by these annotations (host delete cascade).
// writableOnly: leave out the paints the selected scope may not write (made
// with a template of a listing linked into it, see meshPaintWriteGuard) —
// a cascade must not abort the user's own edit of the host on them.
export async function getLiveMeshPaintIdsByHostIds(
  hostIds,
  { writableOnly = false } = {}
) {
  const ids = [...new Set((hostIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = (
    await db.meshPaints.where("hostAnnotationId").anyOf(ids).toArray()
  ).filter(isLive);
  return (writableOnly ? filterMeshPaintsWritableHere(rows) : rows).map(
    (r) => r.id
  );
}

// Ids of the live paints made with these templates (template delete
// cascade).
export async function getLiveMeshPaintIdsByTemplateIds(templateIds) {
  const ids = [...new Set((templateIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await db.meshPaints
    .where("annotationTemplateId")
    .anyOf(ids)
    .toArray();
  return rows.filter(isLive).map((r) => r.id);
}
