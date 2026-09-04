import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import isRemoteNewer from "../utils/isRemoteNewer";
import mapNotesAppEntityToBusinessObject from "../utils/mapNotesAppEntityToBusinessObject";
import downloadNotesAppFile from "./downloadNotesAppFile";

// The notes feed of an object (photos, comments, events...) is stored inline
// on the businessObject row under `notesAppNotes` — schemaless, travels in
// Krto zips with the row. IMPORTANT: adding a note in Krnet does NOT bump the
// entity's updated_at, so the notes merge is keyed on its own signature
// (note ids + timestamps), independently from the entity merge rule.

function getRemoteNotesByEntityId(dump) {
  const byEntityId = new Map();
  for (const note of dump.notes ?? []) {
    if (!note.entityId || note.deletedAt) continue;
    if (!byEntityId.has(note.entityId)) byEntityId.set(note.entityId, []);
    byEntityId.get(note.entityId).push(note);
  }
  for (const notes of byEntityId.values()) {
    // feed order: position (fractional/int) then createdAt
    notes.sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa < pb ? -1 : 1;
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });
  }
  return byEntityId;
}

function getNotesSignature(entries) {
  // fileName presence is part of the signature: a media uploaded to Storage
  // AFTER a first sync (deferred mobile upload, or a failed download that
  // cleared the entry's fileName) doesn't bump the note's updated_at — the
  // resolved-media bit is what triggers the refresh + download retry.
  return (entries ?? [])
    .map(
      (n) =>
        `${n.idMaster}:${n.updatedAt ?? n.createdAt ?? ""}:${n.fileName ? 1 : 0}`
    )
    .sort()
    .join("|");
}

function toNoteEntry(note, mediaIndex) {
  const isMedia = note.type === "photo" || note.type === "audio";
  const media = isMedia ? mediaIndex?.get(note.id) : null;
  return {
    idMaster: note.id,
    type: note.type,
    ...(!isMedia && note.content != null && { content: note.content }),
    ...(media && { fileName: media.fileName }),
    ...(note.settings?.level && { level: note.settings.level }),
    ...(note.position != null && { position: note.position }),
    ...(note.createdAt && { createdAt: new Date(note.createdAt).toISOString() }),
    updatedAt: note.updatedAt ?? note.createdAt ?? null,
  };
}

// Prepares the db.businessObjects rows for one mapped (remote list ->
// "Ouvrages" listing) pair, media downloads of the notes feed included
// (they happen HERE, outside the commit transaction). Pure preparation
// otherwise: the orchestrator commits everything in a single transaction.
export default async function prepareNotesAppBusinessObjectsMerge({
  dump,
  remoteListing,
  listing,
  projectId,
  userIdMaster,
  mediaIndex,
}) {
  const localRows = await db.businessObjects
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
  const remoteNotesByEntityId = getRemoteNotesByEntityId(dump);

  // Seed with existing locals so parent remap and positions can reference
  // rows untouched by this run.
  const objectIdMasterToLocalId = new Map();
  for (const [idMaster, row] of localByIdMaster) {
    objectIdMasterToLocalId.set(idMaster, row.id);
  }

  const rows = [];
  const fileRows = [];
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0, notes: 0 };

  // --- media download helper (skip files already stored locally)
  async function ensureNoteMediaFiles(noteEntries, localObjectId) {
    for (const entry of noteEntries) {
      if (!entry.fileName) continue;
      // A 0-byte local file counts as missing (self-heals a broken download
      // or a Storage object fixed after a first sync).
      const existing = await db.files.get(entry.fileName);
      if (existing?.fileArrayBuffer?.byteLength > 0) continue;
      const media = mediaIndex?.get(entry.idMaster);
      if (!media) continue;
      try {
        const file = await downloadNotesAppFile({
          storagePath: media.storagePath,
          fileName: media.fileName,
          mimeType: media.mimeType,
        });
        const nowIso = new Date().toISOString();
        fileRows.push({
          fileName: media.fileName,
          fileMime: media.mimeType,
          srcFileName: media.fileName,
          fileArrayBuffer: await file.arrayBuffer(),
          projectId,
          listingId: listing.id, // keeps the row inside Krto exports
          entityId: localObjectId,
          createdAt: nowIso,
          updatedAt: nowIso,
          ...(media.mimeType.startsWith("image/") && { fileType: "IMAGE" }),
        });
      } catch (e) {
        console.warn(
          `[notesApp] media download failed for note ${entry.idMaster}`,
          e
        );
        delete entry.fileName; // renderer shows a placeholder
      }
    }
  }

  for (const remote of remoteRows) {
    const local = localByIdMaster.get(remote.id);

    const noteEntries = (remoteNotesByEntityId.get(remote.id) ?? []).map((n) =>
      toNoteEntry(n, mediaIndex)
    );
    const notesChanged =
      getNotesSignature(noteEntries) !==
      getNotesSignature(local?.notesAppNotes);

    const entityNewer = isRemoteNewer(remote.updatedAt, local);

    if (!entityNewer && !notesChanged) {
      counts.unchanged += 1;
      continue;
    }
    // A remote row deleted before it ever reached this device: nothing to do.
    if (remote.deletedAt && !local) {
      counts.unchanged += 1;
      continue;
    }

    const localId = local?.id ?? nanoid();
    objectIdMasterToLocalId.set(remote.id, localId);

    if (notesChanged) {
      await ensureNoteMediaFiles(noteEntries, localId);
      counts.notes += noteEntries.length;
    }

    let row;
    if (entityNewer) {
      const mapped = mapNotesAppEntityToBusinessObject({
        remoteEntity: remote,
        remoteListing,
        localId,
        bimboxaListing: listing,
        projectId,
        userIdMaster,
      });
      // Merge over the local row: fields edited locally in Bimboxa (unit,
      // color...) survive the pull; managed fields are overwritten.
      row = local ? { ...local, ...mapped } : mapped;
      if (local) {
        row.createdAt = local.createdAt ?? row.createdAt;
        row.createdByUserIdMaster =
          local.createdByUserIdMaster ?? row.createdByUserIdMaster;
        // unit and color are Bimboxa-owned once set: keep the local values.
        row.unit = local.unit !== undefined ? local.unit : mapped.unit;
        if (local.color) row.color = local.color;
        // A resurrected remote row must clear a stale local tombstone.
        if (!remote.deletedAt) delete row.deletedAt;
      }
    } else {
      // Only the notes feed changed: refresh it WITHOUT bumping updatedAt so
      // the entity merge rule stays keyed on the remote entity timestamp.
      row = { ...local };
    }
    row.notesAppNotes = noteEntries;
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
    const localParentId = objectIdMasterToLocalId.get(row.parentId);
    // Rows kept as-is (notes-only refresh) already carry a LOCAL parentId.
    if (localParentId) row.parentId = localParentId;
    else if (!localRows.some((l) => l.id === row.parentId)) row.parentId = null;
  }

  return { rows, fileRows, objectIdMasterToLocalId, counts };
}
