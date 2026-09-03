import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import mapNotesAppEntityToBimboxa from "../utils/mapNotesAppEntityToBimboxa";

// Merge rule (loadKrtoZip parity): write a row only when absent locally or
// when the remote row is newer than the local updatedAt. Tombstones
// participate (remote deletedAt is written as a local soft-delete, remote
// timestamps preserved). Reads are NOT filtered by the soft-delete
// middleware, so local tombstones are part of the index.
export function isRemoteNewer(remoteUpdatedAtMs, localRow) {
  if (!localRow) return true;
  const localTs =
    Date.parse(localRow.updatedAt ?? localRow.createdAt ?? "") || 0;
  return (remoteUpdatedAtMs ?? 0) > localTs;
}

// Prepares the db.entities rows for one mapped (remote list -> Bimboxa
// listing) pair. Pure preparation: no write happens here — the orchestrator
// commits everything in a single transaction.
export default async function prepareNotesAppEntitiesMerge({
  dump,
  remoteListing,
  listing,
  projectId,
  userIdMaster,
}) {
  const localRows = await db.entities
    .where("listingId")
    .equals(listing.id)
    .toArray();
  const localByIdMaster = new Map();
  for (const row of localRows) {
    if (row.idMaster && row.remoteSource === "notesApp") {
      localByIdMaster.set(row.idMaster, row);
    }
  }

  const remoteRows = (dump.entities ?? []).filter(
    (e) => e.listingId === remoteListing.id
  );

  // Seed with existing locals so parent remap and positions can reference
  // rows untouched by this run.
  const entityIdMasterToLocalId = new Map();
  for (const [idMaster, row] of localByIdMaster) {
    entityIdMasterToLocalId.set(idMaster, row.id);
  }

  const rows = [];
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0 };

  for (const remote of remoteRows) {
    const local = localByIdMaster.get(remote.id);
    if (!isRemoteNewer(remote.updatedAt, local)) {
      counts.unchanged += 1;
      continue;
    }
    // A remote row deleted before it ever reached this device: nothing to do.
    if (remote.deletedAt && !local) {
      counts.unchanged += 1;
      continue;
    }

    const localId = local?.id ?? nanoid();
    entityIdMasterToLocalId.set(remote.id, localId);

    const mapped = mapNotesAppEntityToBimboxa({
      remoteEntity: remote,
      remoteListing,
      localId,
      bimboxaListing: listing,
      projectId,
      userIdMaster,
    });

    // Merge over the local row: fields added locally in Bimboxa (images, zone
    // assignment...) survive the pull; managed fields are overwritten.
    const row = local ? { ...local, ...mapped } : mapped;
    if (local) {
      row.createdAt = local.createdAt ?? row.createdAt;
      row.createdByUserIdMaster =
        local.createdByUserIdMaster ?? row.createdByUserIdMaster;
      // A resurrected remote row must clear a stale local tombstone.
      if (!remote.deletedAt) delete row.deletedAt;
    }
    rows.push(row);

    if (remote.deletedAt) counts.deleted += 1;
    else if (local) counts.updated += 1;
    else counts.created += 1;
  }

  // Second pass: parentId carries the REMOTE id — remap to local ids. A
  // parent that never reached this device (deleted remotely before the first
  // sync) leaves the child at the tree root.
  for (const row of rows) {
    if (!row.parentId) continue;
    const localParentId = entityIdMasterToLocalId.get(row.parentId);
    if (localParentId) row.parentId = localParentId;
    else delete row.parentId;
  }

  return { rows, entityIdMasterToLocalId, counts };
}
