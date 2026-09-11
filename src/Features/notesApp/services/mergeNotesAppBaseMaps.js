import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

import downloadNotesAppFile from "./downloadNotesAppFile";
import isRemoteNewer from "../utils/isRemoteNewer";
import { getNotesAppMeterByPx } from "../utils/mapNotesAppShapeToAnnotation";

function isBaseMapListing(row) {
  return row?.table === "baseMaps" || row?.entityModel?.type === "BASE_MAP";
}

function getMimeTypeFromPath(path) {
  const ext = (path ?? "").split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

function getLocationEntityIds(remote) {
  const ids = remote?.settings?.locationEntityIds;
  return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
}

function sameIds(a, b) {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((id, i) => id === y[i]);
}

// Prepares the notes-app plans -> db.baseMaps merge. Target listing per plan
// = scope.notesApp.baseMapsMapping entry (an existing BASE_MAP listing of
// the project, or "ignored"), else the project's default BASE_MAP listing
// (loadBaseMapShareZip pattern: prefer key === "mapsGeneric"), created from
// the mapsGeneric preset when the project has none. A plan already imported
// into another listing is MOVED to its target (the orchestrator applies the
// useMoveBaseMapToListing cascade inside the tx), even when the remote row
// is not newer. Ignored plans are skipped and excluded from the id map so
// positions/shapes on them are counted as skipped; a previously imported
// plan is left untouched.
//
// Krnet settings carried over: `locationEntityIds` (plan <-> location
// association, remote entity ids — resolved to local business objects by the
// orchestrator's post-pass) and `scale` (meterByPx rescaled to the local
// image width, written only while the local value is the imported one).
//
// Image downloads happen HERE, outside the Dexie transaction (a non-Dexie
// await inside a tx commits it prematurely). Unchanged storage paths skip
// the download entirely.
export default async function prepareNotesAppBaseMapsMerge({
  dump,
  projectId,
  userIdMaster,
  createdBy,
  appConfig,
  baseMapsMapping,
  onProgress,
}) {
  // --- listings of the project
  const projectListings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && isBaseMapListing(l));
  const listingById = new Map(projectListings.map((l) => [l.id, l]));

  let listingRowToAdd = null;
  let defaultListing =
    projectListings.find((l) => l.key === "mapsGeneric") ??
    projectListings[0] ??
    null;

  if (!defaultListing) {
    const preset = appConfig?.presetListingsObject?.mapsGeneric;
    const entityModel = appConfig?.entityModelsObject?.baseMap;
    listingRowToAdd = {
      id: nanoid(),
      key: "mapsGeneric",
      name: preset?.name ?? "Fonds de plan",
      entityModelKey: "baseMap",
      ...(entityModel && { entityModel }),
      table: "baseMaps",
      ...(preset?.color && { color: preset.color }),
      iconKey: preset?.iconKey ?? "map",
      canCreateItem: true,
      projectId,
      createdByUserIdMaster: userIdMaster,
    };
    defaultListing = listingRowToAdd;
  }

  const mappingByRemoteId = new Map(
    (baseMapsMapping ?? []).map((m) => [m.remoteBaseMapId, m])
  );
  const resolveTarget = (remoteId) => {
    const entry = mappingByRemoteId.get(remoteId);
    if (entry?.mode === "ignored") return null;
    const mapped = entry?.localListingId
      ? listingById.get(entry.localListingId)
      : null;
    return mapped ?? defaultListing;
  };

  // --- local index
  const localRows = (
    await db.baseMaps.where("projectId").equals(projectId).toArray()
  ).filter((b) => b.remoteSource === "notesApp" && b.idMaster);
  const localByIdMaster = new Map(localRows.map((b) => [b.idMaster, b]));

  const remoteRows = dump.baseMaps ?? [];
  const ignoredRemoteIds = new Set(
    [...mappingByRemoteId.values()]
      .filter((m) => m.mode === "ignored")
      .map((m) => m.remoteBaseMapId)
  );

  const baseMapRows = [];
  const fileRows = [];
  const versionRows = [];
  const moves = []; // { baseMapId, sourceListingId, targetListingId }
  const baseMapIdMasterToLocalId = new Map();
  // image width in px per local baseMap id — the positions merge needs it to
  // compute the LABEL chip offset in the normalized frame.
  const baseMapWidthByLocalId = new Map();
  for (const [idMaster, row] of localByIdMaster) {
    if (ignoredRemoteIds.has(idMaster)) continue;
    baseMapIdMasterToLocalId.set(idMaster, row.id);
    baseMapWidthByLocalId.set(
      row.id,
      row.refWidth ?? row.image?.imageSize?.width ?? null
    );
  }

  const counts = {
    created: 0,
    updated: 0,
    moved: 0,
    deleted: 0,
    unchanged: 0,
    skipped: 0,
    ignored: 0,
  };
  const syncedRemoteIds = [];

  let processed = 0;
  for (const remote of remoteRows) {
    processed += 1;
    onProgress?.({
      step: "baseMaps",
      current: processed,
      total: remoteRows.length,
    });

    const local = localByIdMaster.get(remote.id);
    const targetListing = resolveTarget(remote.id);
    if (!targetListing) {
      counts.ignored += 1;
      continue;
    }

    // --- move an imported plan whose target listing changed (independent
    // from the timestamp gate; the row itself is rewritten below if newer)
    const needsMove =
      local &&
      !local.deletedAt &&
      !remote.deletedAt &&
      local.listingId !== targetListing.id;
    if (needsMove) {
      moves.push({
        baseMapId: local.id,
        sourceListingId: local.listingId,
        targetListingId: targetListing.id,
      });
      counts.moved += 1;
    }

    if (!isRemoteNewer(remote.updatedAt, local)) {
      counts.unchanged += 1;
      if (local && !local.deletedAt) syncedRemoteIds.push(remote.id);
      continue;
    }

    const updatedAtIso = remote.updatedAt
      ? new Date(remote.updatedAt).toISOString()
      : new Date().toISOString();

    // --- tombstone
    if (remote.deletedAt) {
      if (!local) {
        counts.unchanged += 1;
        continue;
      }
      baseMapRows.push({
        ...local,
        deletedAt: new Date(remote.deletedAt).toISOString(),
        updatedAt: updatedAtIso,
        remoteUpdatedAt: remote.updatedAt ?? null,
      });
      counts.deleted += 1;
      continue;
    }

    const storagePath = remote.imageStoragePath ?? null;
    const imageChanged =
      storagePath && storagePath !== local?.notesAppStoragePath;

    // A plan that never uploaded its image can't be imported.
    if (!local && !storagePath) {
      console.warn(
        `[notesApp] plan "${remote.name}" has no synced image, skipped`
      );
      counts.skipped += 1;
      continue;
    }

    const localId = local?.id ?? nanoid();
    baseMapIdMasterToLocalId.set(remote.id, localId);
    syncedRemoteIds.push(remote.id);
    // the moved row is rewritten here: stamp its new listing directly
    const listingId = targetListing.id;

    let imageData = null;
    const setWidthFromImage = (data) => {
      if (data?.imageSize?.width) {
        baseMapWidthByLocalId.set(localId, data.imageSize.width);
      }
    };
    if (imageChanged) {
      const file = await downloadNotesAppFile({
        storagePath,
        fileName: storagePath.split("/").pop(),
        mimeType: getMimeTypeFromPath(storagePath),
      });
      if (file.size > 5 * 1024 * 1024) {
        console.warn(
          `[notesApp] plan image "${remote.name}" is ${Math.round(file.size / 1024)} Ko (> 5 Mo)`
        );
      }
      const result = await getEntityPureDataAndFilesDataByKey(
        { name: remote.name, image: { file } },
        {
          entityId: localId,
          projectId,
          listingId,
          listingTable: "baseMaps",
          createdBy,
        }
      );
      imageData = result?.pureData?.image ?? null;
      setWidthFromImage(imageData);
      const fileData = result?.filesDataByKey?.image;
      if (fileData) fileRows.push(fileData);
    }

    const locationEntityIds = getLocationEntityIds(remote);

    if (!local) {
      // --- creation
      const createdAtIso = remote.createdAt
        ? new Date(remote.createdAt).toISOString()
        : updatedAtIso;
      const refWidth = imageData?.imageSize?.width ?? null;
      const meterByPx = getNotesAppMeterByPx(remote.settings?.scale, refWidth);
      const row = {
        id: localId,
        idMaster: remote.id,
        remoteSource: "notesApp",
        remoteUpdatedAt: remote.updatedAt ?? null,
        notesAppStoragePath: storagePath,
        notesAppLocationEntityIds: locationEntityIds,
        listingId,
        projectId,
        name: remote.name,
        image: imageData,
        ...(imageData?.imageSize && {
          refWidth: imageData.imageSize.width,
          refHeight: imageData.imageSize.height,
        }),
        ...(meterByPx != null && {
          meterByPx,
          notesAppMeterByPx: meterByPx,
        }),
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        createdByUserIdMaster: userIdMaster,
      };
      baseMapRows.push(row);
      if (imageData) {
        versionRows.push({
          id: nanoid(),
          baseMapId: localId,
          projectId,
          listingId,
          label: "Image d'origine",
          fractionalIndex: "a0",
          isActive: true,
          image: imageData,
          transform: { x: 0, y: 0, rotation: 0, scale: 1 },
          createdByUserIdMaster: userIdMaster,
        });
      }
      counts.created += 1;
    } else {
      // --- update (metadata always; image only when the storage path moved)
      const row = {
        ...local,
        name: remote.name,
        listingId,
        remoteUpdatedAt: remote.updatedAt ?? null,
        notesAppLocationEntityIds: locationEntityIds,
        updatedAt: updatedAtIso,
      };
      delete row.deletedAt; // resurrected remotely
      if (imageData) {
        row.image = imageData;
        row.notesAppStoragePath = storagePath;
        if (imageData.imageSize) {
          row.refWidth = imageData.imageSize.width;
          row.refHeight = imageData.imageSize.height;
        }
        // Refresh the active version's image so versioned rendering follows.
        const versions = await db.baseMapVersions
          .where("baseMapId")
          .equals(local.id)
          .toArray();
        const activeVersion =
          versions.find((v) => v.isActive && !v.deletedAt) ??
          versions.find((v) => !v.deletedAt);
        if (activeVersion) {
          versionRows.push({ ...activeVersion, image: imageData, listingId });
        }
      }
      // Calibration: follow Krnet only while the local value is the one we
      // imported (a user calibration in Bimboxa is never clobbered).
      const refWidth = row.refWidth ?? row.image?.imageSize?.width ?? null;
      const meterByPx = getNotesAppMeterByPx(remote.settings?.scale, refWidth);
      const localIsImported =
        row.meterByPx == null ||
        (row.notesAppMeterByPx != null &&
          row.meterByPx === row.notesAppMeterByPx);
      if (meterByPx != null && localIsImported) {
        row.meterByPx = meterByPx;
        row.notesAppMeterByPx = meterByPx;
      }
      baseMapRows.push(row);
      counts.updated += 1;
    }
  }

  // --- resolved remote-ids -> local rows, for the orchestrator's location
  // post-pass (rows about to be written win over the stored ones)
  const rowsByLocalId = new Map();
  for (const row of localRows) rowsByLocalId.set(row.id, row);
  for (const row of baseMapRows) rowsByLocalId.set(row.id, row);

  return {
    listingRowToAdd,
    defaultListing,
    baseMapRows,
    fileRows,
    versionRows,
    moves,
    rowsByLocalId,
    syncedRemoteIds,
    baseMapIdMasterToLocalId,
    baseMapWidthByLocalId,
    counts,
  };
}

// Post-pass helper: resolves `notesAppLocationEntityIds` (Krnet entity ids)
// to local business-object ids and returns the FULL rows whose value
// changed (bulkPut replaces rows), merged by id into `baseMapRows`.
export function applyNotesAppBaseMapLocations({
  rowsByLocalId,
  baseMapRows,
  ignoredLocalIds,
  objectIdMasterToLocalId,
}) {
  const rowsById = new Map(baseMapRows.map((r) => [r.id, r]));
  for (const [localId, row] of rowsByLocalId) {
    if (row.deletedAt || ignoredLocalIds?.has(localId)) continue;
    const remoteIds = row.notesAppLocationEntityIds ?? [];
    const localIds = remoteIds
      .map((id) => objectIdMasterToLocalId.get(id))
      .filter(Boolean);
    if (sameIds(localIds, row.notesAppLocationBusinessObjectIds)) continue;
    rowsById.set(localId, {
      ...(rowsById.get(localId) ?? row),
      notesAppLocationBusinessObjectIds: localIds,
    });
  }
  return [...rowsById.values()];
}
