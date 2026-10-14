import db from "App/db/db";

import linkListingsToScopeService from "Features/listings/services/linkListingsToScopeService";
import copyListingsToScopeService from "Features/listings/services/copyListingsToScopeService";

export const SOURCE_SCOPE_MODES = {
  LINK: "LINK", // listings linked read-only (db.relsScopeListing)
  COPY: "COPY", // listings + annotations duplicated, host becomes owner
};

// The source scope's OWN drawing listings (LOCATED_ENTITY entity model, by
// paternity — a listing the source itself borrowed is not chained).
export async function getSourceScopeListings({ sourceScopeId, appConfig }) {
  if (!sourceScopeId) return [];
  const entityModelsObject = appConfig?.entityModelsObject ?? {};
  const listings = await db.listings
    .where("scopeId")
    .equals(sourceScopeId)
    .toArray();
  return listings.filter((l) => {
    if (!l || l.deletedAt) return false;
    const entityModel =
      l.entityModel ?? entityModelsObject?.[l.entityModelKey] ?? null;
    return entityModel?.type === "LOCATED_ENTITY";
  });
}

/**
 * « Krto source » at scope creation: bring the drawing listings of another
 * scope of the project into the freshly created host scope, either LINKED
 * (read-only, rel rows only) or COPIED (new owned rows). Returns the number
 * of listings brought in (0 when nothing to do).
 */
export default async function applySourceScopeService({
  hostScope,
  sourceScopeId,
  mode,
  appConfig,
  createdBy,
}) {
  if (!hostScope?.id || !sourceScopeId || sourceScopeId === hostScope.id)
    return 0;

  const listings = await getSourceScopeListings({ sourceScopeId, appConfig });
  if (listings.length === 0) return 0;

  if (mode === SOURCE_SCOPE_MODES.COPY) {
    const { newListingIds } = await copyListingsToScopeService({
      hostScope,
      listings,
      createdBy,
    });
    return newListingIds.length;
  }

  const rels = await linkListingsToScopeService({ hostScope, listings });
  return rels.length;
}
