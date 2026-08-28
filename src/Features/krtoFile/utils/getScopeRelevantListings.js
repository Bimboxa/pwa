// Listings that belong to a scope's export/stats perimeter:
// - listings bound to the scope (scopeId match: LOCATED_ENTITY, BLUEPRINT, ...)
// - project listings without scopeId (shared: BASE_MAP, etc.)
// - every BASE_MAP / PHOTO listing of the project, even when still bound to
//   another scope's id (e.g. the scope it was created in, or the source of a
//   duplicated scope) — baseMaps and photo albums are project-shared, so
//   dropping them would strip base-map images from a duplicated scope's zip.
// Single source of truth shared by createKrtoZip and computeScopeStats: the
// stats sent with a saved configuration must match the zip's own perimeter.
export default function getScopeRelevantListings(allProjectListings, scopeId) {
  return allProjectListings.filter((listing) => {
    if (listing.scopeId === scopeId) return true;
    if (!listing.scopeId) return true; // scopeId absent, undefined ou null
    if (listing.entityModel?.type === "BASE_MAP") return true;
    if (listing.entityModel?.type === "PHOTO") return true;
    return false;
  });
}
