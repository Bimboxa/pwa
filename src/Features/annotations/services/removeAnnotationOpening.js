import db from "App/db/db";

/**
 * Soft-deletes an opening relation by its id (soft-delete middleware sets
 * deletedAt instead of hard-removing the row).
 *
 * @param {string} relId
 */
export default async function removeAnnotationOpening(relId) {
  if (!relId) return;
  await db.relAnnotationOpenings.delete(relId);
}
