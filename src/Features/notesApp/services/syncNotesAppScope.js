import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import { getNotesAppSession } from "./notesAppAuthService";
import fetchNotesAppProjectDump from "./fetchNotesAppProjectDump";
import prepareNotesAppEntitiesMerge from "./mergeNotesAppEntities";
import prepareNotesAppBaseMapsMerge from "./mergeNotesAppBaseMaps";
import prepareNotesAppPositionsMerge from "./mergeNotesAppPositions";
import { upsertMappingEntry } from "../utils/resolveNotesAppScopeLink";

// Pull orchestrator: one project dump, then per mapped (remote list ->
// Bimboxa listing) pair the entities + positions merges, plans merged once
// at project level. Everything is prepared first (downloads included), then
// committed in ONE transaction under withSystemWrite(withoutUndo(...)):
// ownership/read-only guards bypassed, remote timestamps preserved, local
// change tracker and undo stack untouched.
//
// Remote lists without a mapping entry default to "create a linked listing"
// (notesObject model, named after the remote list). Explicit "ignored"
// entries are skipped.
export default async function syncNotesAppScope({
  scope,
  appConfig,
  userIdMaster,
  createdBy,
  createListings,
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

  // --- create the missing linked listings (before the merge tx:
  // useCreateListings has its own writes + entityModel resolution)
  if (remoteListingsToCreate.length > 0) {
    onProgress?.({ step: "createListings", count: remoteListingsToCreate.length });
    const created = await createListings({
      listings: remoteListingsToCreate.map((r) => ({
        name: r.name,
        entityModelKey: "notesObject",
        table: "entities",
        ...(r.color && { color: r.color }),
        iconKey: "annotation",
        spriteImageKey: "DEFAULT",
        canCreateItem: true,
      })),
      scope,
    });
    created.forEach((listing, i) => {
      const remoteListing = remoteListingsToCreate[i];
      pairs.push({ remoteListing, listing });
      listingsMapping = upsertMappingEntry(listingsMapping, {
        remoteListingId: remoteListing.id,
        remoteListingName: remoteListing.name,
        localListingId: listing.id,
        mode: "mapped",
      });
    });
  }

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

  // --- per-pair entities + positions
  const nowIso = new Date().toISOString();
  const merges = [];
  for (const pair of pairs) {
    onProgress?.({ step: "entities", listingName: pair.remoteListing.name });
    const entitiesMerge = await prepareNotesAppEntitiesMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      projectId: scope.projectId,
      userIdMaster,
    });
    const positionsMerge = await prepareNotesAppPositionsMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      scope,
      projectId: scope.projectId,
      userIdMaster,
      entityIdMasterToLocalId: entitiesMerge.entityIdMasterToLocalId,
      baseMapIdMasterToLocalId: baseMapsMerge.baseMapIdMasterToLocalId,
    });
    merges.push({ pair, entitiesMerge, positionsMerge });

    listingsMapping = upsertMappingEntry(listingsMapping, {
      remoteListingId: pair.remoteListing.id,
      remoteListingName: pair.remoteListing.name,
      localListingId: pair.listing.id,
      mode: "mapped",
      lastSyncAt: nowIso,
      lastSyncCounts: {
        entities:
          entitiesMerge.counts.created +
          entitiesMerge.counts.updated +
          entitiesMerge.counts.deleted,
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
          db.entities,
          db.baseMaps,
          db.baseMapVersions,
          db.annotations,
          db.points,
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
          for (const { entitiesMerge, positionsMerge } of merges) {
            if (entitiesMerge.rows.length) {
              await db.entities.bulkPut(entitiesMerge.rows);
            }
            if (positionsMerge.pointRows.length) {
              await db.points.bulkPut(positionsMerge.pointRows);
            }
            if (positionsMerge.annotationRows.length) {
              await db.annotations.bulkPut(positionsMerge.annotationRows);
            }
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
  for (const { entitiesMerge, positionsMerge } of merges) {
    counts.entities +=
      entitiesMerge.counts.created +
      entitiesMerge.counts.updated +
      entitiesMerge.counts.deleted;
    counts.positions +=
      positionsMerge.counts.created +
      positionsMerge.counts.updated +
      positionsMerge.counts.deleted;
  }
  return { counts };
}
