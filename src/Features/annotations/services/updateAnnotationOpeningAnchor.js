import db from "App/db/db";

/**
 * Rewrites the anchor payload of an opening relation — used after a reflow
 * re-anchors the opening (host segment split / carved between the stored
 * vertices) or clamps its distance (segment became too short).
 *
 * Only provided fields are written.
 *
 * @param {string} relId
 * @param {Object} anchor
 * @param {string} [anchor.hostSegmentStartPointId]
 * @param {string} [anchor.hostSegmentEndPointId]
 * @param {string|null} [anchor.hostArcControlPointId]
 * @param {number} [anchor.hostDistanceM]
 * @param {Object} [anchor.carve]
 */
export default async function updateAnnotationOpeningAnchor(relId, anchor) {
  if (!relId || !anchor) return;
  const changes = {};
  for (const key of [
    "hostSegmentStartPointId",
    "hostSegmentEndPointId",
    "hostArcControlPointId",
    "hostDistanceM",
    "carve",
  ]) {
    if (anchor[key] !== undefined) changes[key] = anchor[key];
  }
  if (Object.keys(changes).length === 0) return;
  await db.relAnnotationOpenings.update(relId, changes);
}
