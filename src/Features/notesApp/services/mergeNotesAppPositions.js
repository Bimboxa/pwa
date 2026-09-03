import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { isRemoteNewer } from "./mergeNotesAppEntities";

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

// Prepares the notes-app annotations (one optional position per object) ->
// Bimboxa MARKER annotations + db.points rows for one mapped pair.
//
// notes-app x/y are normalized 0..1 against the plan image — the exact same
// frame as db.points (normalized vs baseMap.image.imageSize): coordinates
// copy over with no transform. A moved position mints a FRESH point id and
// rewrites annotation.point (a db.points row is never rewritten in place —
// POINTS_STORAGE.md contract). scopeId is stamped explicitly on point rows:
// the central auto-stamp hook is skipped under system writes.
export default async function prepareNotesAppPositionsMerge({
  dump,
  remoteListing,
  listing,
  scope,
  projectId,
  userIdMaster,
  entityIdMasterToLocalId,
  baseMapIdMasterToLocalId,
}) {
  const remoteEntityIds = new Set(
    (dump.entities ?? [])
      .filter((e) => e.listingId === remoteListing.id)
      .map((e) => e.id)
  );
  const remoteRows = (dump.annotations ?? []).filter((a) =>
    remoteEntityIds.has(a.entityId)
  );

  const localRows = (
    await db.annotations.where("listingId").equals(listing.id).toArray()
  ).filter((a) => a.remoteSource === "notesApp" && a.idMaster);
  const localByIdMaster = new Map(localRows.map((a) => [a.idMaster, a]));

  const annotationRows = [];
  const pointRows = [];
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0 };

  for (const remote of remoteRows) {
    const local = localByIdMaster.get(remote.id);
    if (!isRemoteNewer(remote.updatedAt, local)) {
      counts.unchanged += 1;
      continue;
    }

    const updatedAtIso = remote.updatedAt
      ? new Date(remote.updatedAt).toISOString()
      : new Date().toISOString();

    // --- tombstone (point rows are left behind, harmless orphans)
    if (remote.deletedAt) {
      if (!local) {
        counts.unchanged += 1;
        continue;
      }
      annotationRows.push({
        ...local,
        deletedAt: new Date(remote.deletedAt).toISOString(),
        updatedAt: updatedAtIso,
        remoteUpdatedAt: remote.updatedAt ?? null,
      });
      counts.deleted += 1;
      continue;
    }

    const localEntityId = entityIdMasterToLocalId.get(remote.entityId);
    const localBaseMapId = baseMapIdMasterToLocalId.get(remote.baseMapId);
    if (!localEntityId || !localBaseMapId) {
      // Plan or object without a local counterpart (e.g. plan skipped for a
      // missing image): count and move on.
      counts.skipped += 1;
      continue;
    }

    const pointId = nanoid();
    pointRows.push({
      id: pointId,
      x: clamp01(remote.x),
      y: clamp01(remote.y),
      projectId,
      listingId: listing.id,
      baseMapId: localBaseMapId,
      scopeId: scope.id,
    });

    if (!local) {
      const createdAtIso = remote.createdAt
        ? new Date(remote.createdAt).toISOString()
        : updatedAtIso;
      annotationRows.push({
        id: nanoid(),
        idMaster: remote.id,
        remoteSource: "notesApp",
        remoteUpdatedAt: remote.updatedAt ?? null,
        type: "MARKER",
        point: { id: pointId },
        entityId: localEntityId,
        listingId: listing.id,
        baseMapId: localBaseMapId,
        projectId,
        fillColor: listing.color ?? "#0288D1",
        iconKey: "circle",
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        createdByUserIdMaster: userIdMaster,
      });
      counts.created += 1;
    } else {
      annotationRows.push({
        ...local,
        point: { id: pointId },
        entityId: localEntityId,
        baseMapId: localBaseMapId,
        updatedAt: updatedAtIso,
        remoteUpdatedAt: remote.updatedAt ?? null,
        deletedAt: undefined,
      });
      counts.updated += 1;
    }
  }

  // Drop the explicit `deletedAt: undefined` (bulkPut would store the key).
  for (const row of annotationRows) {
    if (row.deletedAt === undefined) delete row.deletedAt;
  }

  return { annotationRows, pointRows, counts };
}
