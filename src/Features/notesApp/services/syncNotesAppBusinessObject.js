import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import canLocateBusinessObjects from "Features/businessObjects/utils/canLocateBusinessObjects";

import { getNotesAppSession } from "./notesAppAuthService";
import fetchNotesAppEntityBundle from "./fetchNotesAppEntityBundle";
import buildNotesAppMediaIndex from "./buildNotesAppMediaIndex";
import prepareNotesAppBusinessObjectsMerge from "./mergeNotesAppBusinessObjects";
import { getLocalNotesAppBaseMapIndex } from "./mergeNotesAppBaseMaps";
import prepareNotesAppPositionsMerge from "./mergeNotesAppPositions";
import prepareNotesAppShapesMerge from "./mergeNotesAppShapes";
import resolveNotesAppTemplates from "./resolveNotesAppTemplates";
import { isShapeType } from "../utils/mapNotesAppShapeToAnnotation";

// Per-object pull (the "Récupérer" button of the object header): ONE
// Krnet-linked business object, its related objects (link / category
// targets, objects sharing one of its shapes), its notes feed + media, its
// links, its positions and its shapes — nothing is sent to Krnet. Same
// merge rules and the same single-transaction commit as the scope pull
// (syncNotesAppScope), on mini dumps (fetchNotesAppEntityBundle):
// - objects: one merge per (remote list -> local listing) pair the fetched
//   objects belong to, resolved through scope.notesApp.listingsMapping; the
//   objects of an unmapped list are ignored (counted);
// - positions / shapes: the object's own pair only. Plans are NOT merged:
//   the local imported plans index stands in for the plans merge (a
//   position on a plan never imported is skipped, as in the scope pull);
// - no scope.notesApp.lastSyncAt stamp (scope-pull bookkeeping).

function makeError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

export default async function syncNotesAppBusinessObject({
  businessObject,
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
  if (businessObject?.remoteSource !== "notesApp" || !businessObject.idMaster) {
    throw makeError(
      "Business object is not linked to a notes-app object",
      "NOTES_APP_OBJECT_NOT_LINKED"
    );
  }
  const session = await getNotesAppSession();
  if (!session) {
    throw makeError("Not signed in to notes-app", "NOTES_APP_NOT_SIGNED_IN");
  }

  const listing = await db.listings.get(businessObject.listingId);
  if (!listing || listing.deletedAt) {
    throw makeError("Listing of the business object not found");
  }

  const bundle = await fetchNotesAppEntityBundle({
    entityId: businessObject.idMaster,
  });
  if (!bundle.entity) {
    throw makeError(
      "Object not found in notes-app",
      "NOTES_APP_OBJECT_NOT_FOUND"
    );
  }

  // The object's remote list must be the one mapped on its local listing:
  // an object moved to another Krnet list is the scope pull's business.
  const listingsMapping = link.listingsMapping ?? [];
  const mappedRemoteListingId =
    listingsMapping.find(
      (m) => m.mode === "mapped" && m.localListingId === listing.id
    )?.remoteListingId ??
    listing.idMaster ??
    null;
  if (
    mappedRemoteListingId &&
    bundle.entity.listingId !== mappedRemoteListingId
  ) {
    throw makeError(
      "Object moved to another notes-app list",
      "NOTES_APP_OBJECT_MOVED"
    );
  }

  const projectId = scope.projectId;
  const mediaIndex = await buildNotesAppMediaIndex(link.projectId);

  // --- pairs (remote list -> local listing) of the fetched objects
  const localListingIdByRemoteId = new Map();
  for (const m of listingsMapping) {
    if (m.mode === "mapped" && m.localListingId) {
      localListingIdByRemoteId.set(m.remoteListingId, m.localListingId);
    }
  }
  localListingIdByRemoteId.set(bundle.entity.listingId, listing.id);

  const remoteListingIds = [
    ...new Set(
      bundle.objectsDump.entities.map((e) => e.listingId).filter(Boolean)
    ),
  ];
  const pairs = []; // { remoteListing, listing }
  let relatedIgnored = 0;
  for (const remoteListingId of remoteListingIds) {
    const remoteListing = bundle.remoteListingById.get(remoteListingId);
    const localListingId = localListingIdByRemoteId.get(remoteListingId);
    const localListing = localListingId
      ? await db.listings.get(localListingId)
      : null;
    if (!remoteListing || !localListing || localListing.deletedAt) {
      relatedIgnored += bundle.objectsDump.entities.filter(
        (e) => e.listingId === remoteListingId
      ).length;
      continue;
    }
    pairs.push({ remoteListing, listing: localListing });
  }
  const mainPair = pairs.find(
    (p) => p.remoteListing.id === bundle.entity.listingId
  );
  if (!mainPair) {
    throw makeError("Remote list of the object is not readable");
  }

  // --- objects (the object + its related objects), per pair
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

  // --- positions + shapes of the object (its own pair)
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
      remoteListing: mainPair.remoteListing,
      shapes,
      projectId,
      appConfig,
      userIdMaster,
    });
  const positionsMerge = await prepareNotesAppPositionsMerge({
    dump: bundle.shapesDump,
    remoteListing: mainPair.remoteListing,
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
    remoteListing: mainPair.remoteListing,
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

  // --- single transaction
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.transaction(
        "rw",
        [
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
        }
      )
    )
  );

  // --- counts for the UI
  const mainRow = merges
    .flatMap(({ objectsMerge }) => objectsMerge.rows)
    .find((row) => row.id === businessObject.id);
  const counts = {
    entity: !mainRow ? "unchanged" : mainRow.deletedAt ? "deleted" : "updated",
    related: 0,
    relatedIgnored,
    notes: 0,
    links: 0,
    positions: 0,
    shapes: 0,
  };
  for (const { objectsMerge } of merges) {
    counts.related += objectsMerge.rows.filter(
      (row) => row.id !== businessObject.id
    ).length;
    counts.notes += objectsMerge.counts.notes;
    counts.links += objectsMerge.counts.links;
  }
  counts.positions =
    positionsMerge.counts.created +
    positionsMerge.counts.updated +
    positionsMerge.counts.deleted;
  counts.shapes =
    shapesMerge.counts.created +
    shapesMerge.counts.updated +
    shapesMerge.counts.deleted;
  return { counts };
}
