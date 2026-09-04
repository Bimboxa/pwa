import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import createBusinessObjectListingService from "Features/businessObjects/services/createBusinessObjectListingService";

import { getNotesAppSession } from "./notesAppAuthService";
import fetchNotesAppProjectDump from "./fetchNotesAppProjectDump";
import buildNotesAppMediaIndex from "./buildNotesAppMediaIndex";
import prepareNotesAppBusinessObjectsMerge from "./mergeNotesAppBusinessObjects";
import prepareNotesAppBaseMapsMerge from "./mergeNotesAppBaseMaps";
import prepareNotesAppPositionsMerge from "./mergeNotesAppPositions";
import resolveNotesAppLocationTemplate from "./resolveNotesAppLocationTemplate";
import { upsertMappingEntry } from "../utils/resolveNotesAppScopeLink";

// Pull orchestrator: one project dump, then per mapped (remote list ->
// "Ouvrages" listing) pair the business-objects + positions merges, plans
// merged once at project level. Everything is prepared first (downloads
// included), then committed in ONE transaction under
// withSystemWrite(withoutUndo(...)): ownership/read-only guards bypassed,
// remote timestamps preserved, local change tracker and undo stack untouched.
//
// Remote lists without a mapping entry default to "create a linked Ouvrages
// listing" (named after the remote list). Explicit "ignored" entries are
// skipped. Positions follow the located-business-objects contract: LABEL
// annotations issued from one of the listing's own annotationTemplates
// (created from the appConfig default when missing), flagged as the object's
// MAIN annotation via relsBusinessObjectAnnotation { isMain, baseMapId }.

// Companion listing used by earlier versions to host imported MARKERs — its
// annotations are migrated into the businessObjects listings, the listing
// itself is tombstoned.
const LEGACY_POSITIONS_LISTING_KEY = "notesAppPositions";

async function resolveLegacyPositionsListing(scope) {
  const scopeListings = await db.listings
    .where("projectId")
    .equals(scope.projectId)
    .toArray();
  return (
    scopeListings.find(
      (l) =>
        !l.deletedAt &&
        l.scopeId === scope.id &&
        l.key === LEGACY_POSITIONS_LISTING_KEY
    ) ?? null
  );
}

export default async function syncNotesAppScope({
  scope,
  appConfig,
  userIdMaster,
  createdBy,
  onProgress,
}) {
  const link = scope?.notesApp;
  if (!link?.projectId) {
    throw new Error("Scope is not linked to a notes-app project");
  }
  const session = await getNotesAppSession();
  if (!session) {
    const error = new Error("Not signed in to notes-app");
    error.code = "NOTES_APP_NOT_SIGNED_IN";
    throw error;
  }

  onProgress?.({ step: "fetch" });
  const dump = await fetchNotesAppProjectDump(link.projectId);
  // noteId -> storage path/mime for the notes-feed media (photos, audio)
  const mediaIndex = await buildNotesAppMediaIndex(link.projectId);

  const remoteListings = (dump.listings ?? []).filter((l) => !l.deletedAt);

  // --- resolve mapping decisions
  let listingsMapping = [...(link.listingsMapping ?? [])];
  const pairs = []; // { remoteListing, listing }
  const remoteListingsToCreate = [];

  for (const remoteListing of remoteListings) {
    const entry = listingsMapping.find(
      (m) => m.remoteListingId === remoteListing.id
    );
    if (entry?.mode === "ignored") continue;
    let localListing = entry?.localListingId
      ? await db.listings.get(entry.localListingId)
      : null;
    if (localListing?.deletedAt) localListing = null;
    if (localListing) pairs.push({ remoteListing, listing: localListing });
    else remoteListingsToCreate.push(remoteListing);
  }

  // --- create the missing linked "Ouvrages" listings (before the merge tx:
  // the service has its own write + entityModel resolution)
  for (const remoteListing of remoteListingsToCreate) {
    onProgress?.({ step: "createListings", listingName: remoteListing.name });
    const listing = await createBusinessObjectListingService({
      projectId: scope.projectId,
      scopeId: scope.id,
      name: remoteListing.name,
      appConfig,
    });
    pairs.push({ remoteListing, listing });
    listingsMapping = upsertMappingEntry(listingsMapping, {
      remoteListingId: remoteListing.id,
      remoteListingName: remoteListing.name,
      localListingId: listing.id,
      mode: "mapped",
    });
  }

  // --- legacy companion listing (earlier versions hosted bare MARKERs
  // there): its annotations are migrated per pair, the listing tombstoned.
  const legacyPositionsListing = await resolveLegacyPositionsListing(scope);

  // --- plans first (positions need the id map); downloads happen inside,
  // OUTSIDE the transaction below.
  const baseMapsMerge = await prepareNotesAppBaseMapsMerge({
    dump,
    projectId: scope.projectId,
    userIdMaster,
    createdBy,
    appConfig,
    onProgress,
  });

  // --- per-pair business objects + positions
  const nowIso = new Date().toISOString();
  const merges = [];
  for (const pair of pairs) {
    onProgress?.({ step: "objects", listingName: pair.remoteListing.name });
    const objectsMerge = await prepareNotesAppBusinessObjectsMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      projectId: scope.projectId,
      userIdMaster,
      mediaIndex,
    });
    // location template of the listing (its own annotationTemplates; created
    // from the appConfig default when it has none)
    const { template: locationTemplate, templateRowToAdd } =
      await resolveNotesAppLocationTemplate({
        listing: pair.listing,
        projectId: scope.projectId,
        appConfig,
        userIdMaster,
      });
    const positionsMerge = await prepareNotesAppPositionsMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      locationTemplate,
      legacyPositionsListing,
      scope,
      projectId: scope.projectId,
      userIdMaster,
      objectIdMasterToLocalId: objectsMerge.objectIdMasterToLocalId,
      baseMapIdMasterToLocalId: baseMapsMerge.baseMapIdMasterToLocalId,
      baseMapWidthByLocalId: baseMapsMerge.baseMapWidthByLocalId,
    });
    merges.push({ pair, objectsMerge, positionsMerge, templateRowToAdd });

    listingsMapping = upsertMappingEntry(listingsMapping, {
      remoteListingId: pair.remoteListing.id,
      remoteListingName: pair.remoteListing.name,
      localListingId: pair.listing.id,
      mode: "mapped",
      lastSyncAt: nowIso,
      lastSyncCounts: {
        entities:
          objectsMerge.counts.created +
          objectsMerge.counts.updated +
          objectsMerge.counts.deleted,
        positions:
          positionsMerge.counts.created +
          positionsMerge.counts.updated +
          positionsMerge.counts.deleted,
      },
    });
  }

  // --- single transaction
  onProgress?.({ step: "write" });
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
          db.scopes,
          db.listings,
          db.businessObjects,
          db.relsBusinessObjectAnnotation,
          db.baseMaps,
          db.baseMapVersions,
          db.annotations,
          db.annotationTemplates,
          db.files,
        ],
        async () => {
          if (baseMapsMerge.listingRowToAdd) {
            await db.listings.put(baseMapsMerge.listingRowToAdd);
          }
          if (baseMapsMerge.fileRows.length) {
            await db.files.bulkPut(baseMapsMerge.fileRows);
          }
          if (baseMapsMerge.baseMapRows.length) {
            await db.baseMaps.bulkPut(baseMapsMerge.baseMapRows);
          }
          if (baseMapsMerge.versionRows.length) {
            await db.baseMapVersions.bulkPut(baseMapsMerge.versionRows);
          }
          for (const {
            objectsMerge,
            positionsMerge,
            templateRowToAdd,
          } of merges) {
            if (templateRowToAdd) {
              await db.annotationTemplates.put(templateRowToAdd);
            }
            if (objectsMerge.rows.length) {
              await db.businessObjects.bulkPut(objectsMerge.rows);
            }
            if (objectsMerge.fileRows.length) {
              await db.files.bulkPut(objectsMerge.fileRows);
            }
            if (positionsMerge.annotationRows.length) {
              await db.annotations.bulkPut(positionsMerge.annotationRows);
            }
            if (positionsMerge.relRows.length) {
              await db.relsBusinessObjectAnnotation.bulkPut(
                positionsMerge.relRows
              );
            }
          }
          // migrated companion listing: nothing points at it any more
          if (legacyPositionsListing) {
            await db.listings.update(legacyPositionsListing.id, {
              deletedAt: nowIso,
            });
          }
          await db.scopes.update(scope.id, {
            notesApp: {
              ...link,
              listingsMapping,
              lastSyncAt: nowIso,
              lastSyncStatus: "success",
            },
          });
        }
      )
    )
  );

  // --- aggregate counts for the UI
  const counts = {
    listings: pairs.length,
    entities: 0,
    positions: 0,
    baseMaps:
      baseMapsMerge.counts.created +
      baseMapsMerge.counts.updated +
      baseMapsMerge.counts.deleted,
  };
  for (const { objectsMerge, positionsMerge } of merges) {
    counts.entities +=
      objectsMerge.counts.created +
      objectsMerge.counts.updated +
      objectsMerge.counts.deleted;
    counts.positions +=
      positionsMerge.counts.created +
      positionsMerge.counts.updated +
      positionsMerge.counts.deleted;
  }
  return { counts };
}
