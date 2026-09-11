import enableScopeModuleService from "Features/scopeConfig/services/enableScopeModuleService";
import { getBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

import { getNotesAppSession } from "./notesAppAuthService";
import fetchNotesAppListingBundle from "./fetchNotesAppListingBundle";
import buildNotesAppMediaIndex from "./buildNotesAppMediaIndex";
import prepareNotesAppBusinessObjectsMerge from "./mergeNotesAppBusinessObjects";
import { getLocalNotesAppBaseMapIndex } from "./mergeNotesAppBaseMaps";
import prepareNotesAppPositionsMerge from "./mergeNotesAppPositions";
import prepareNotesAppShapesMerge from "./mergeNotesAppShapes";
import prepareNotesAppListingConfigMerge from "./mergeNotesAppListingConfig";
import resolveNotesAppTemplates from "./resolveNotesAppTemplates";
import { upsertMappingEntry } from "../utils/resolveNotesAppScopeLink";
import { isShapeType } from "../utils/mapNotesAppShapeToAnnotation";

// Per-listing pull (the "Récupérer" icon button of the listing header): ONE
// Krnet-linked "Ouvrages" listing — every object of the remote list, their
// notes feed + media, their links, their positions and shapes, the objects
// related to them (link / category targets, objects sharing a shape) and
// the list configuration (fields, state models, codification) — nothing is
// sent to Krnet. Same merge rules and the same single-transaction commit as
// the scope pull (syncNotesAppScope), on the mini dumps of
// fetchNotesAppListingBundle:
// - objects: one merge per (remote list -> local listing) pair the fetched
//   objects belong to, resolved through scope.notesApp.listingsMapping; the
//   related objects of an unmapped list are ignored (counted);
// - positions / shapes / configuration: the listing's own pair only. Plans
//   are NOT merged: the local imported plans index stands in (a position on
//   a plan never imported is skipped, as in the scope pull);
// - the listing's mapping entry gets its lastSyncAt / lastSyncCounts stamp;
//   scope.notesApp.lastSyncAt (project-level) is left alone.

function makeError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

// Remote list mapped on a local listing: the scope mapping entry wins over
// the listing's own idMaster (same rule as the per-object pull).
export function getNotesAppRemoteListingId({ listing, scope }) {
  const listingsMapping = scope?.notesApp?.listingsMapping ?? [];
  return (
    listingsMapping.find(
      (m) => m.mode === "mapped" && m.localListingId === listing?.id
    )?.remoteListingId ??
    listing?.idMaster ??
    null
  );
}

export default async function syncNotesAppListing({
  listing,
  scope,
  appConfig,
  userIdMaster,
}) {
  const link = scope?.notesApp;
  if (!link?.projectId) {
    throw makeError(
      "Scope is not linked to a notes-app project",
      "NOTES_APP_SCOPE_NOT_LINKED"
    );
  }
  if (!listing?.id || listing.deletedAt) {
    throw makeError("Listing not found");
  }
  const remoteListingId = getNotesAppRemoteListingId({ listing, scope });
  if (!remoteListingId) {
    throw makeError(
      "Listing is not linked to a notes-app list",
      "NOTES_APP_LISTING_NOT_LINKED"
    );
  }
  const session = await getNotesAppSession();
  if (!session) {
    throw makeError("Not signed in to notes-app", "NOTES_APP_NOT_SIGNED_IN");
  }

  const bundle = await fetchNotesAppListingBundle({ remoteListingId });
  const remoteListing = bundle.remoteListing;
  if (!remoteListing) {
    throw makeError(
      "List not found in notes-app",
      "NOTES_APP_LISTING_NOT_FOUND"
    );
  }
  // the scope pull skips deleted remote lists: nothing to merge here either
  if (remoteListing.deletedAt) {
    throw makeError("List deleted in notes-app", "NOTES_APP_LISTING_DELETED");
  }

  const projectId = scope.projectId;
  const mediaIndex = await buildNotesAppMediaIndex(link.projectId);

  // --- pairs (remote list -> local listing) of the fetched objects
  const listingsMapping = link.listingsMapping ?? [];
  const localListingIdByRemoteId = new Map();
  for (const m of listingsMapping) {
    if (m.mode === "mapped" && m.localListingId) {
      localListingIdByRemoteId.set(m.remoteListingId, m.localListingId);
    }
  }
  localListingIdByRemoteId.set(remoteListingId, listing.id);

  const remoteListingIds = [
    ...new Set(
      bundle.objectsDump.entities.map((e) => e.listingId).filter(Boolean)
    ),
  ];
  const pairs = []; // { remoteListing, listing }
  let relatedIgnored = 0;
  for (const id of remoteListingIds) {
    const pairRemoteListing = bundle.remoteListingById.get(id);
    const localListingId = localListingIdByRemoteId.get(id);
    const localListing =
      id === remoteListingId
        ? listing
        : localListingId
          ? await db.listings.get(localListingId)
          : null;
    if (!pairRemoteListing || !localListing || localListing.deletedAt) {
      relatedIgnored += bundle.objectsDump.entities.filter(
        (e) => e.listingId === id
      ).length;
      continue;
    }
    pairs.push({ remoteListing: pairRemoteListing, listing: localListing });
  }
  if (!pairs.some((p) => p.listing.id === listing.id)) {
    // empty remote list: still merge the configuration below
    pairs.unshift({ remoteListing, listing });
  }

  // --- objects (the list's objects + their related objects), per pair
  const merges = [];
  const objectIdMasterToLocalId = new Map();
  for (const pair of pairs) {
    const objectsMerge = await prepareNotesAppBusinessObjectsMerge({
      dump: bundle.objectsDump,
      remoteListing: pair.remoteListing,
      listing: pair.listing,
      projectId,
      userIdMaster,
      mediaIndex,
    });
    for (const [idMaster, localId] of objectsMerge.objectIdMasterToLocalId) {
      objectIdMasterToLocalId.set(idMaster, localId);
    }
    merges.push({ pair, objectsMerge });
  }
  // objects of the lists not part of this run (rels of shared shapes)
  const projectObjects = await db.businessObjects
    .where("projectId")
    .equals(projectId)
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

  // --- positions + shapes of the list (its own pair)
  const { baseMapIdMasterToLocalId, baseMapWidthByLocalId } =
    await getLocalNotesAppBaseMapIndex({
      projectId,
      baseMapsMapping: link.baseMapsMapping,
    });
  const shapes = [
    "LABEL",
    ...new Set(
      bundle.shapesDump.annotations
        .filter((a) => isShapeType(a.type) && !a.deletedAt)
        .map((a) => a.type)
    ),
  ];
  const { templatesByShape, templateRowsToAdd } =
    await resolveNotesAppTemplates({
      listing,
      remoteListing,
      shapes,
      projectId,
      appConfig,
      userIdMaster,
    });
  const positionsMerge = await prepareNotesAppPositionsMerge({
    dump: bundle.shapesDump,
    remoteListing,
    listing,
    locationTemplate: templatesByShape.LABEL,
    legacyPositionsListing: null,
    scope,
    projectId,
    userIdMaster,
    objectIdMasterToLocalId,
    baseMapIdMasterToLocalId,
    baseMapWidthByLocalId,
  });
  const shapesMerge = await prepareNotesAppShapesMerge({
    dump: bundle.shapesDump,
    remoteListing,
    listing,
    templatesByShape,
    scope,
    projectId,
    userIdMaster,
    objectIdMasterToLocalId,
    baseMapIdMasterToLocalId,
    claimedShapeIds: new Set(),
    relsContext: {
      listingRels: positionsMerge.listingRels,
      relRowsById: positionsMerge.relRowsById,
    },
  });

  // --- list configuration (Krnet settings + state models)
  const remoteToLocalListingId = new Map(localListingIdByRemoteId);
  const configMerge = await prepareNotesAppListingConfigMerge({
    dump: bundle.configDump,
    remoteListing,
    listing,
    remoteToLocalListingId,
  });

  // --- mapping entry stamp
  const nowIso = new Date().toISOString();
  const positionsCount =
    positionsMerge.counts.created +
    positionsMerge.counts.updated +
    positionsMerge.counts.deleted;
  const shapesCount =
    shapesMerge.counts.created +
    shapesMerge.counts.updated +
    shapesMerge.counts.deleted;
  const mainMerge = merges.find(({ pair }) => pair.listing.id === listing.id);
  const mainCounts = mainMerge.objectsMerge.counts;
  const nextListingsMapping = upsertMappingEntry(listingsMapping, {
    remoteListingId,
    remoteListingName: remoteListing.name,
    localListingId: listing.id,
    mode: "mapped",
    lastSyncAt: nowIso,
    lastSyncCounts: {
      entities: mainCounts.created + mainCounts.updated + mainCounts.deleted,
      positions: positionsCount,
      shapes: shapesCount,
    },
  });

  // --- single transaction
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
          db.scopes,
          db.listings,
          db.businessObjects,
          db.relsBusinessObjectAnnotation,
          db.annotations,
          db.annotationTemplates,
          db.points,
          db.files,
        ],
        async () => {
          if (templateRowsToAdd.length) {
            await db.annotationTemplates.bulkPut(templateRowsToAdd);
          }
          if (!canLocateBusinessObjects(listing)) {
            await db.listings.update(listing.id, {
              canLocateBusinessObjects: true,
            });
          }
          if (configMerge?.patch) {
            await db.listings.update(listing.id, configMerge.patch);
          }
          for (const { objectsMerge } of merges) {
            if (objectsMerge.rows.length) {
              await db.businessObjects.bulkPut(objectsMerge.rows);
            }
            if (objectsMerge.fileRows.length) {
              await db.files.bulkPut(objectsMerge.fileRows);
            }
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
          const relRows = [...shapesMerge.relRowsById.values()];
          if (relRows.length) {
            await db.relsBusinessObjectAnnotation.bulkPut(relRows);
          }
          await db.scopes.update(scope.id, {
            notesApp: { ...link, listingsMapping: nextListingsMapping },
          });
        }
      )
    )
  );

  // --- counts for the UI
  const counts = {
    created: mainCounts.created,
    updated: mainCounts.updated,
    deleted: mainCounts.deleted,
    unchanged: mainCounts.unchanged,
    related: 0,
    relatedIgnored,
    notes: 0,
    links: 0,
    positions: positionsCount,
    shapes: shapesCount,
    config: configMerge?.counts.applied ?? 0,
  };
  for (const { pair, objectsMerge } of merges) {
    if (pair.listing.id !== listing.id) {
      counts.related += objectsMerge.rows.length;
    }
    counts.notes += objectsMerge.counts.notes;
    counts.links += objectsMerge.counts.links;
  }
  await enableScopeModuleService({
    scopeId: scope.id,
    projectId: scope.projectId,
    moduleKey: getBusinessObjectsModuleKey(
      configMerge?.patch?.businessObjectType ?? listing.businessObjectType
    ),
    appConfig,
  });
  return { counts };
}
