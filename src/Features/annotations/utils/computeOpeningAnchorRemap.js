// Anchor remap for a glued-opening relation after a host point id swap
// (vertex fork mints a fresh id, snap-replace substitutes the target id).
// The rel anchors the opening on host point IDS — when the host's refs are
// rewritten the anchor must follow the same old-id -> new-id map, otherwise
// it references an orphaned point and the reflow falls back to a projection
// re-anchor instead of keeping the exact hostDistanceM semantics.

const ANCHOR_ID_FIELDS = [
  "hostSegmentStartPointId",
  "hostSegmentEndPointId",
  "hostArcControlPointId",
];

/**
 * @param {Object} rel - relAnnotationOpenings row
 * @param {Object} pointIdMap - { [oldPointId]: newPointId }
 * @returns {Object|null} changes to persist on the rel, or null when the
 *   anchor references none of the remapped ids (or the rel is soft-deleted)
 */
export default function computeOpeningAnchorRemap(rel, pointIdMap) {
  if (!rel || rel.deletedAt || !pointIdMap) return null;
  const changes = {};
  for (const field of ANCHOR_ID_FIELDS) {
    const id = rel[field];
    if (id && pointIdMap[id]) changes[field] = pointIdMap[id];
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
