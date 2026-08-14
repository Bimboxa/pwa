import db from "App/db/db";

import { isLegacyStyleRevolutionHelper } from "../constants/drawingShapeConfig";

// Scope rule of the revolution helpers (REVOLUTION_AXIS /
// REVOLUTION_AXIS_PLACEMENT), mirroring the useAnnotationsV2 scope filter:
// template-driven rows follow their LISTING's scopeId; pre-template rows carry
// their own scopeId (none = visible in every scope). With no selected scope,
// everything is in scope.
//
// Needed wherever helpers are read straight from Dexie (axis pickers, the
// one-placement-per-base-map replacement at commit, the CHATEAU_EAU_V1
// duplicate-axis guard): two scopes may each pose their own axis on the same
// vertical base map, so cross-scope rows must never count as duplicates.
export default function isRevolutionHelperInScope(
  annotation,
  { scopeId, scopeIdByListingId }
) {
  if (!scopeId) return true;
  if (isLegacyStyleRevolutionHelper(annotation)) {
    return !annotation.scopeId || annotation.scopeId === scopeId;
  }
  return scopeIdByListingId?.get(annotation.listingId) === scopeId;
}

/** listingId → scopeId map of the given annotations' listings (Dexie). */
export async function getScopeIdByListingId(annotations) {
  const listingIds = [
    ...new Set((annotations ?? []).map((a) => a.listingId).filter(Boolean)),
  ];
  const listings = listingIds.length
    ? (await db.listings.bulkGet(listingIds)).filter(Boolean)
    : [];
  return new Map(listings.map((l) => [l.id, l.scopeId]));
}
