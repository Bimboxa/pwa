import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

/**
 * Creates a relation linking a mesh cell annotation to its parent annotation
 * ("maillage"). Mirrors addAnnotationSubtraction.
 *
 * Guards against self-reference and duplicate (non-deleted) pairs.
 *
 * @param {Object} args
 * @param {string} args.projectId
 * @param {string} args.parentAnnotationId - the subdivided annotation
 * @param {string} args.meshCellAnnotationId - the generated mesh cell
 * @returns {Promise<string|null>} the created relation id, or null if skipped
 */
export default async function addMeshCellRelation({
  projectId,
  parentAnnotationId,
  meshCellAnnotationId,
}) {
  if (!projectId || !parentAnnotationId || !meshCellAnnotationId) return null;
  if (parentAnnotationId === meshCellAnnotationId) return null;

  const existing = await db.relAnnotationMeshCells
    .where("parentAnnotationId")
    .equals(parentAnnotationId)
    .toArray();
  const alreadyExists = existing.some(
    (r) => !r.deletedAt && r.meshCellAnnotationId === meshCellAnnotationId
  );
  if (alreadyExists) return null;

  const id = nanoid();
  await db.relAnnotationMeshCells.add({
    id,
    projectId,
    parentAnnotationId,
    meshCellAnnotationId,
  });
  return id;
}
