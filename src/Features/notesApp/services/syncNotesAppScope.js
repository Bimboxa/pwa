import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import createBusinessObjectListingService from "Features/businessObjects/services/createBusinessObjectListingService";
import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

import { getNotesAppSession } from "./notesAppAuthService";
import fetchNotesAppProjectDump from "./fetchNotesAppProjectDump";
import buildNotesAppMediaIndex from "./buildNotesAppMediaIndex";
import prepareNotesAppBusinessObjectsMerge from "./mergeNotesAppBusinessObjects";
import prepareNotesAppBaseMapsMerge, {
  applyNotesAppBaseMapLocations,
} from "./mergeNotesAppBaseMaps";
import prepareNotesAppPositionsMerge from "./mergeNotesAppPositions";
import prepareNotesAppShapesMerge from "./mergeNotesAppShapes";
import prepareNotesAppListingConfigMerge from "./mergeNotesAppListingConfig";
import resolveNotesAppTemplates from "./resolveNotesAppTemplates";
import {
  upsertMappingEntry,
  upsertBaseMapMappingEntry,
} from "../utils/resolveNotesAppScopeLink";
import { isShapeType } from "../utils/mapNotesAppShapeToAnnotation";

// Pull orchestrator: one project dump, then per mapped (remote list ->
// "Ouvrages" listing) pair the business-objects + positions + shapes merges,
// plans merged once at project level. Everything is prepared first
// (downloads included), then committed in ONE transaction under
// withSystemWrite(withoutUndo(...)): ownership/read-only guards bypassed,
// remote timestamps preserved, local change tracker and undo stack untouched.
//
// Remote lists without a mapping entry default to "create a linked Ouvrages
// listing" (named after the remote list). Explicit "ignored" entries are
// skipped. Plans follow scope.notesApp.baseMapsMapping (target base-map
// listing per plan, or ignored; default = the project's "Fonds de plan"
// listing). Positions follow the located-business-objects contract: LABEL
// annotations issued from one of the listing's own annotationTemplates
// (created from the appConfig default when missing), flagged as the object's
// MAIN annotation via relsBusinessObjectAnnotation { isMain, baseMapId }.
// Krnet drawings (POLYLINE / POLYGON) become annotations of the same listing
// (own templates per shape, db.points rows) linked to their objects through
// plain rels. The listing configuration (Krnet settings + state models) is
// merged per pair as well, into listing.notesApp (see
// mergeNotesAppListingConfig). Plan <-> location associations are resolved
// to local business objects in a post-pass (all pairs merged).

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

// Same cascade as useMoveBaseMapToListing, inside the sync transaction.
async function moveBaseMapToListing({
  baseMapId,
  sourceListingId,
  targetListingId,
}) {
  await db.baseMaps.update(baseMapId, { listingId: targetListingId });
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMapId)
    .toArray();
  await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMapId)
    .modify({ listingId: targetListingId });
  await db.files
    .where("entityId")
    .equals(baseMapId)
    .modify({ listingId: targetListingId });
  const versionFileNames = versions
    .map((v) => v.image?.fileName)
    .filter(Boolean);
  if (versionFileNames.length > 0) {
    await db.files
      .where("fileName")
      .anyOf(versionFileNames)
      .modify({ listingId: targetListingId });
  }
  const retag = (row) => {
    if (row.listingId === sourceListingId) row.listingId = targetListingId;
  };
  await db.annotations.where("baseMapId").equals(baseMapId).modify(retag);
  await db.points.where("baseMapId").equals(baseMapId).modify(retag);
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
  let baseMapsMapping = [...(link.baseMapsMapping ?? [])];
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
      // Krnet positions are main annotations: the listing is located
      canLocateBusinessObjects: true,
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

  // --- remote -> local listing ids, for the listing refs held by the Krnet
  // settings (nomenclatures, link targets). Mapped-but-tombstoned remote
  // lists are included so their refs still resolve.
  const remoteToLocalListingId = new Map();
  for (const m of listingsMapping) {
    if (m.mode === "mapped" && m.localListingId) {
      remoteToLocalListingId.set(m.remoteListingId, m.localListingId);
    }
  }
  for (const pair of pairs) {
    remoteToLocalListingId.set(pair.remoteListing.id, pair.listing.id);
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
    baseMapsMapping,
    onProgress,
  });

  // --- which shapes each pair may own (drawn from the remote list, or
  // linked to one of its objects when listing_id is null)
  const shapeTypesByRemoteListingId = new Map();
  const relsByAnnotationId = new Map();
  for (const rel of dump.relsEntityAnnotation ?? []) {
    if (rel?.deletedAt || !rel?.annotationId) continue;
    const list = relsByAnnotationId.get(rel.annotationId) ?? [];
    list.push(rel);
    relsByAnnotationId.set(rel.annotationId, list);
  }
  const remoteListingIdByEntityId = new Map(
    (dump.entities ?? []).map((e) => [e.id, e.listingId])
  );
  for (const a of dump.annotations ?? []) {
    if (!isShapeType(a.type) || a.deletedAt) continue;
    const listingIds = a.listingId
      ? [a.listingId]
      : (relsByAnnotationId.get(a.id) ?? [])
          .map((r) => remoteListingIdByEntityId.get(r.entityId))
          .filter(Boolean);
    for (const listingId of listingIds) {
      const set = shapeTypesByRemoteListingId.get(listingId) ?? new Set();
      set.add(a.type);
      shapeTypesByRemoteListingId.set(listingId, set);
    }
  }

  // --- per-pair business objects + positions + shapes
  const nowIso = new Date().toISOString();
  const merges = [];
  const claimedShapeIds = new Set();
  const objectIdMasterToLocalId = new Map();
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
    for (const [idMaster, localId] of objectsMerge.objectIdMasterToLocalId) {
      objectIdMasterToLocalId.set(idMaster, localId);
    }
    // templates of the listing (its own annotationTemplates; created from
    // the defaults when it has none for a shape)
    const shapes = [
      "LABEL",
      ...(shapeTypesByRemoteListingId.get(pair.remoteListing.id) ?? []),
    ];
    const { templatesByShape, templateRowsToAdd } =
      await resolveNotesAppTemplates({
        listing: pair.listing,
        remoteListing: pair.remoteListing,
        shapes,
        projectId: scope.projectId,
        appConfig,
        userIdMaster,
      });
    const positionsMerge = await prepareNotesAppPositionsMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      locationTemplate: templatesByShape.LABEL,
      legacyPositionsListing,
      scope,
      projectId: scope.projectId,
      userIdMaster,
      objectIdMasterToLocalId: objectsMerge.objectIdMasterToLocalId,
      baseMapIdMasterToLocalId: baseMapsMerge.baseMapIdMasterToLocalId,
      baseMapWidthByLocalId: baseMapsMerge.baseMapWidthByLocalId,
    });
    const shapesMerge = await prepareNotesAppShapesMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      templatesByShape,
      scope,
      projectId: scope.projectId,
      userIdMaster,
      objectIdMasterToLocalId: objectsMerge.objectIdMasterToLocalId,
      baseMapIdMasterToLocalId: baseMapsMerge.baseMapIdMasterToLocalId,
      claimedShapeIds,
      relsContext: {
        listingRels: positionsMerge.listingRels,
        relRowsById: positionsMerge.relRowsById,
      },
    });
    const configMerge = await prepareNotesAppListingConfigMerge({
      dump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      remoteToLocalListingId,
    });
    merges.push({
      pair,
      objectsMerge,
      positionsMerge,
      shapesMerge,
      templateRowsToAdd,
      configMerge,
    });

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
        shapes:
          shapesMerge.counts.created +
          shapesMerge.counts.updated +
          shapesMerge.counts.deleted,
      },
    });
  }

  // --- plan <-> location post-pass: Krnet location entity ids -> local
  // business objects (objects of lists not re-synced this run are read
  // from the db).
  const projectObjects = await db.businessObjects
    .where("projectId")
    .equals(scope.projectId)
    .toArray();
  for (const o of projectObjects) {
    if (
      o.remoteSource === "notesApp" &&
      o.idMaster &&
      !o.deletedAt &&
      !objectIdMasterToLocalId.has(o.idMaster)
    ) {
      objectIdMasterToLocalId.set(o.idMaster, o.id);
    }
  }
  const ignoredRemoteBaseMapIds = new Set(
    baseMapsMapping
      .filter((m) => m.mode === "ignored")
      .map((m) => m.remoteBaseMapId)
  );
  const ignoredLocalBaseMapIds = new Set(
    [...baseMapsMerge.rowsByLocalId.values()]
      .filter((r) => ignoredRemoteBaseMapIds.has(r.idMaster))
      .map((r) => r.id)
  );
  const baseMapRows = applyNotesAppBaseMapLocations({
    rowsByLocalId: baseMapsMerge.rowsByLocalId,
    baseMapRows: baseMapsMerge.baseMapRows,
    ignoredLocalIds: ignoredLocalBaseMapIds,
    objectIdMasterToLocalId,
  });

  // explicit plan mappings get a sync stamp (absence stays "default")
  for (const remoteId of baseMapsMerge.syncedRemoteIds) {
    if (baseMapsMapping.some((m) => m.remoteBaseMapId === remoteId)) {
      baseMapsMapping = upsertBaseMapMappingEntry(baseMapsMapping, {
        remoteBaseMapId: remoteId,
        lastSyncAt: nowIso,
      });
    }
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
          if (baseMapRows.length) {
            await db.baseMaps.bulkPut(baseMapRows);
          }
          if (baseMapsMerge.versionRows.length) {
            await db.baseMapVersions.bulkPut(baseMapsMerge.versionRows);
          }
          // moves after the row writes: the cascade retags versions/files
          // (rewritten rows already carry the target listing)
          for (const move of baseMapsMerge.moves) {
            await moveBaseMapToListing(move);
          }
          for (const {
            pair,
            objectsMerge,
            positionsMerge,
            shapesMerge,
            templateRowsToAdd,
            configMerge,
          } of merges) {
            if (templateRowsToAdd.length) {
              await db.annotationTemplates.bulkPut(templateRowsToAdd);
            }
            // Krnet-mapped listings are always located (their positions are
            // main annotations); backfills the listings mapped before the
            // flag existed.
            if (!canLocateBusinessObjects(pair.listing)) {
              await db.listings.update(pair.listing.id, {
                canLocateBusinessObjects: true,
              });
            }
            if (configMerge?.patch) {
              await db.listings.update(pair.listing.id, configMerge.patch);
            }
            if (objectsMerge.rows.length) {
              await db.businessObjects.bulkPut(objectsMerge.rows);
            }
            if (objectsMerge.fileRows.length) {
              await db.files.bulkPut(objectsMerge.fileRows);
            }
            if (shapesMerge.pointRows.length) {
              await db.points.bulkAdd(shapesMerge.pointRows);
            }
            const annotationRows = [
              ...positionsMerge.annotationRows,
              ...shapesMerge.annotationRows,
            ];
            if (annotationRows.length) {
              await db.annotations.bulkPut(annotationRows);
            }
            // one rels context per pair, shared by both passes
            const relRows = [...shapesMerge.relRowsById.values()];
            if (relRows.length) {
              await db.relsBusinessObjectAnnotation.bulkPut(relRows);
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
              baseMapsMapping,
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
    shapes: 0,
    listingsConfig: 0,
    baseMaps:
      baseMapsMerge.counts.created +
      baseMapsMerge.counts.updated +
      baseMapsMerge.counts.deleted,
    baseMapsMoved: baseMapsMerge.counts.moved,
    baseMapsIgnored: baseMapsMerge.counts.ignored,
    baseMapsSkipped: baseMapsMerge.counts.skipped,
  };
  for (const {
    objectsMerge,
    positionsMerge,
    shapesMerge,
    configMerge,
  } of merges) {
    counts.listingsConfig += configMerge?.counts.applied ?? 0;
    counts.entities +=
      objectsMerge.counts.created +
      objectsMerge.counts.updated +
      objectsMerge.counts.deleted;
    counts.positions +=
      positionsMerge.counts.created +
      positionsMerge.counts.updated +
      positionsMerge.counts.deleted;
    counts.shapes +=
      shapesMerge.counts.created +
      shapesMerge.counts.updated +
      shapesMerge.counts.deleted;
  }
  return { counts };
}
