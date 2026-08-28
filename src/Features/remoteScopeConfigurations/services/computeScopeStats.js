import db from "App/db/db";

import getScopeRelevantListings from "Features/krtoFile/utils/getScopeRelevantListings";

// Key content indicators of a scope, sent as metadata with a saved
// configuration (Push body) and displayed as badges on dashboard scope rows.
// Counts match what the user sees in the app, not the raw zip content:
// - annotationsCount: non-deleted annotations, excluding technical
//   pseudo-annotations (base-map annotations, isForBaseMaps listings,
//   profile-template annotations). Bg-image text annotations are synthesized
//   at read time (no db row) so a Dexie count naturally excludes them.
// - baseMapsCount: non-deleted real baseMaps — isDetail baseMaps (rendered on
//   the fly from PDFs, hidden from pickers) are excluded.
// The listing perimeter is the one createKrtoZip exports (shared util).
export default async function computeScopeStats(scopeId) {
  const scope = await db.scopes.get(scopeId);
  if (!scope) throw new Error(`Scope ${scopeId} not found`);
  const projectId = scope.projectId;

  const allProjectListings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();
  const relevantListings = getScopeRelevantListings(
    allProjectListings,
    scopeId
  );
  const listingIds = new Set(relevantListings.map((l) => l.id));
  const forBaseMapsListingIds = new Set(
    relevantListings.filter((l) => l.isForBaseMaps).map((l) => l.id)
  );

  const profileTemplateIds = new Set(
    (
      await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .toArray()
    )
      .filter((t) => t.isProfile)
      .map((t) => t.id)
  );

  const annotationsCount = (
    await db.annotations.where("projectId").equals(projectId).toArray()
  ).filter(
    (a) =>
      !a.deletedAt &&
      listingIds.has(a.listingId) &&
      !forBaseMapsListingIds.has(a.listingId) &&
      !a.isBaseMapAnnotation &&
      !profileTemplateIds.has(a.annotationTemplateId)
  ).length;

  const baseMapsCount = (
    await db.baseMaps.where("projectId").equals(projectId).toArray()
  ).filter(
    (bm) => !bm.deletedAt && !bm.isDetail && listingIds.has(bm.listingId)
  ).length;

  return { annotationsCount, baseMapsCount };
}
