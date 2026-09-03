import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

import downloadNotesAppFile from "./downloadNotesAppFile";
import isRemoteNewer from "../utils/isRemoteNewer";

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

// Prepares the notes-app plans -> db.baseMaps merge. All plans of the linked
// notes-app project land in the project's existing BASE_MAP listing
// (loadBaseMapShareZip pattern: prefer key === "mapsGeneric"), created from
// the mapsGeneric preset when the project has none. Image downloads happen
// HERE, outside the Dexie transaction (a non-Dexie await inside a tx commits
// it prematurely). Unchanged storage paths skip the download entirely.
export default async function prepareNotesAppBaseMapsMerge({
  dump,
  projectId,
  userIdMaster,
  createdBy,
  appConfig,
  onProgress,
}) {
  // --- target listing
  const projectListings = (
    await db.listings.where("projectId").equals(projectId).toArray()
  ).filter((l) => !l.deletedAt && isBaseMapListing(l));

  let listingRowToAdd = null;
  let baseMapListing =
    projectListings.find((l) => l.key === "mapsGeneric") ??
    projectListings[0] ??
    null;

  if (!baseMapListing) {
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
    baseMapListing = listingRowToAdd;
  }

  // --- local index
  const localRows = (
    await db.baseMaps.where("projectId").equals(projectId).toArray()
  ).filter((b) => b.remoteSource === "notesApp" && b.idMaster);
  const localByIdMaster = new Map(localRows.map((b) => [b.idMaster, b]));

  const remoteRows = dump.baseMaps ?? [];

  const baseMapRows = [];
  const fileRows = [];
  const versionRows = [];
  const baseMapIdMasterToLocalId = new Map();
  for (const [idMaster, row] of localByIdMaster) {
    baseMapIdMasterToLocalId.set(idMaster, row.id);
  }

  const counts = {
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    skipped: 0,
  };

  let processed = 0;
  for (const remote of remoteRows) {
    processed += 1;
    onProgress?.({
      step: "baseMaps",
      current: processed,
      total: remoteRows.length,
    });

    const local = localByIdMaster.get(remote.id);
    if (!isRemoteNewer(remote.updatedAt, local)) {
      counts.unchanged += 1;
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
    const imageChanged = storagePath && storagePath !== local?.notesAppStoragePath;

    // A plan that never uploaded its image can't be imported.
    if (!local && !storagePath) {
      console.warn(`[notesApp] plan "${remote.name}" has no synced image, skipped`);
      counts.skipped += 1;
      continue;
    }

    const localId = local?.id ?? nanoid();
    baseMapIdMasterToLocalId.set(remote.id, localId);

    let imageData = null;
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
          listingId: baseMapListing.id,
          listingTable: "baseMaps",
          createdBy,
        }
      );
      imageData = result?.pureData?.image ?? null;
      const fileData = result?.filesDataByKey?.image;
      if (fileData) fileRows.push(fileData);
    }

    if (!local) {
      // --- creation
      const createdAtIso = remote.createdAt
        ? new Date(remote.createdAt).toISOString()
        : updatedAtIso;
      const row = {
        id: localId,
        idMaster: remote.id,
        remoteSource: "notesApp",
        remoteUpdatedAt: remote.updatedAt ?? null,
        notesAppStoragePath: storagePath,
        listingId: baseMapListing.id,
        projectId,
        name: remote.name,
        image: imageData,
        ...(imageData?.imageSize && {
          refWidth: imageData.imageSize.width,
          refHeight: imageData.imageSize.height,
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
          listingId: baseMapListing.id,
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
        remoteUpdatedAt: remote.updatedAt ?? null,
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
          versionRows.push({ ...activeVersion, image: imageData });
        }
      }
      baseMapRows.push(row);
      counts.updated += 1;
    }
  }

  return {
    listingRowToAdd,
    baseMapListing,
    baseMapRows,
    fileRows,
    versionRows,
    baseMapIdMasterToLocalId,
    counts,
  };
}
