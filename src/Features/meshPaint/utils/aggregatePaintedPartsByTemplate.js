// Painted parts rolled up per painting template (+ per listing) —
// node-testable (relative imports only).
//
// Every listed part stays in `parts` (orphans and conflicts included, for the
// detail list); only counted parts (status OK) with a quantity feed the sums
// and the faces / edges counts.
import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

/**
 * @param {Array<Object>} parts - resolvePaintedParts output.
 * @returns {{
 *   byTemplateId: Object<string, {
 *     surface: number, length: number,
 *     partsCount: number,    // counted parts
 *     facesCount: number, edgesCount: number, // counted parts by type
 *     orphansCount: number, conflictsCount: number,
 *     staleCount: number,    // counted parts whose host changed since sync
 *     listedCount: number,   // parts.length
 *     parts: Array<Object>,
 *   }>,
 *   countsByListingId: Object<string, number>, // counted parts per OWN listing
 *   templateIds: Set<string>, // templates with at least one listed part
 *   listingIds: Set<string>,  // own listings with at least one listed part
 * }}
 */
export default function aggregatePaintedPartsByTemplate(parts) {
  const byTemplateId = {};
  const countsByListingId = {};
  const templateIds = new Set();
  const listingIds = new Set();

  for (const part of parts ?? []) {
    const templateId = part?.annotationTemplateId;
    if (!templateId) continue;

    let stats = byTemplateId[templateId];
    if (!stats) {
      stats = {
        surface: 0,
        length: 0,
        partsCount: 0,
        facesCount: 0,
        edgesCount: 0,
        orphansCount: 0,
        conflictsCount: 0,
        staleCount: 0,
        listedCount: 0,
        parts: [],
      };
      byTemplateId[templateId] = stats;
    }

    stats.parts.push(part);
    stats.listedCount += 1;
    templateIds.add(templateId);
    if (part.listingId) listingIds.add(part.listingId);

    if (part.isOrphan) stats.orphansCount += 1;
    if (part.isConflict) stats.conflictsCount += 1;
    if (!part.isCounted) continue;

    stats.partsCount += 1;
    if (part.partType === MESH_PAINT_PART_TYPES.FACE) stats.facesCount += 1;
    if (part.partType === MESH_PAINT_PART_TYPES.EDGE) stats.edgesCount += 1;
    if (part.isStale) stats.staleCount += 1;
    if (part.qtiesEnabled) {
      if (Number.isFinite(part.surface)) stats.surface += part.surface;
      if (Number.isFinite(part.length)) stats.length += part.length;
    }
    if (part.listingId)
      countsByListingId[part.listingId] =
        (countsByListingId[part.listingId] ?? 0) + 1;
  }

  return { byTemplateId, countsByListingId, templateIds, listingIds };
}
