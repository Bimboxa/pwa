import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

/**
 * Creates a directional subtraction relation between two annotations:
 * sourceAnnotation - targetAnnotation (3D boolean + quantity impact).
 *
 * Guards against self-subtraction and duplicate (non-deleted) pairs.
 *
 * @param {Object} args
 * @param {string} args.projectId
 * @param {string} args.sourceAnnotationId - annotation being carved
 * @param {string} args.targetAnnotationId - annotation subtracted from the source
 * @returns {Promise<string|null>} the created relation id, or null if skipped
 */
export default async function addAnnotationSubtraction({
  projectId,
  sourceAnnotationId,
  targetAnnotationId,
}) {
  if (!projectId || !sourceAnnotationId || !targetAnnotationId) return null;
  if (sourceAnnotationId === targetAnnotationId) return null;

  // Skip if a non-deleted relation already exists for this ordered pair.
  const existing = await db.relAnnotationSubtractions
    .where("sourceAnnotationId")
    .equals(sourceAnnotationId)
    .toArray();
  const alreadyExists = existing.some(
    (r) => !r.deletedAt && r.targetAnnotationId === targetAnnotationId
  );
  if (alreadyExists) return null;

  const id = nanoid();
  await db.relAnnotationSubtractions.add({
    id,
    projectId,
    sourceAnnotationId,
    targetAnnotationId,
  });
  return id;
}
