import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

// Links listings of OTHER scopes into a host scope ("Depuis un autre Krto",
// db.relsScopeListing). The listing keeps its own scopeId (paternity); the
// host only gets a rel row. Invariants: at most ONE live rel per
// (scopeId, listingId) — existing pairs are skipped; a listing is never
// linked into its own scope; a listing without scopeId (shared BASE_MAP /
// PHOTO) is already visible everywhere and is skipped too. Returns the
// created rels.
export default async function linkListingsToScopeService({
  hostScope,
  listings,
}) {
  if (!hostScope?.id || !listings?.length) return [];

  return db.transaction("rw", db.relsScopeListing, async () => {
    const existingRels = (
      await db.relsScopeListing.where("scopeId").equals(hostScope.id).toArray()
    ).filter((r) => !r.deletedAt);
    const linkedListingIds = new Set(existingRels.map((r) => r.listingId));

    const seen = new Set();
    const newRels = [];
    for (const listing of listings) {
      const listingId = listing?.id;
      if (!listingId || seen.has(listingId)) continue;
      seen.add(listingId);
      if (linkedListingIds.has(listingId)) continue;
      if (!listing.scopeId || listing.scopeId === hostScope.id) continue;
      newRels.push({
        id: nanoid(),
        projectId: hostScope.projectId ?? listing.projectId,
        scopeId: hostScope.id,
        listingId,
        sourceScopeId: listing.scopeId,
      });
    }

    if (newRels.length > 0) {
      await db.relsScopeListing.bulkAdd(newRels);
    }
    return newRels;
  });
}
