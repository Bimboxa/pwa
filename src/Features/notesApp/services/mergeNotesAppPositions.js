import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import isRemoteNewer from "../utils/isRemoteNewer";

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

// Prepares the notes-app annotations (one optional position per object) ->
// Bimboxa MARKER annotations + db.points + relsBusinessObjectAnnotation rows
// for one mapped (remote list -> "Ouvrages" listing) pair.
//
// Business objects don't own annotations (no entityId): the markers live in
// the scope's companion "Repères" listing (resolved by the orchestrator) and
// each one is linked to its object through a rel row — the same N-N link the
// Ouvrages module creates by hand.
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
  listing, // the mapped businessObjects listing
  positionsListing, // the scope's companion annotation listing for markers
  scope,
  projectId,
  userIdMaster,
  objectIdMasterToLocalId,
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
    await db.annotations
      .where("listingId")
      .equals(positionsListing.id)
      .toArray()
  ).filter((a) => a.remoteSource === "notesApp" && a.idMaster);
  const localByIdMaster = new Map(localRows.map((a) => [a.idMaster, a]));

  const annotationRows = [];
  const pointRows = [];
  const relRows = [];
  const tombstonedAnnotationIds = [];
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
      tombstonedAnnotationIds.push(local.id);
      counts.deleted += 1;
      continue;
    }

    const localObjectId = objectIdMasterToLocalId.get(remote.entityId);
    const localBaseMapId = baseMapIdMasterToLocalId.get(remote.baseMapId);
    if (!localObjectId || !localBaseMapId) {
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
      listingId: positionsListing.id,
      baseMapId: localBaseMapId,
      scopeId: scope.id,
    });

    let annotationId;
    if (!local) {
      annotationId = nanoid();
      const createdAtIso = remote.createdAt
        ? new Date(remote.createdAt).toISOString()
        : updatedAtIso;
      annotationRows.push({
        id: annotationId,
        idMaster: remote.id,
        remoteSource: "notesApp",
        remoteUpdatedAt: remote.updatedAt ?? null,
        type: "MARKER",
        point: { id: pointId },
        listingId: positionsListing.id,
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
      annotationId = local.id;
      const row = {
        ...local,
        point: { id: pointId },
        baseMapId: localBaseMapId,
        updatedAt: updatedAtIso,
        remoteUpdatedAt: remote.updatedAt ?? null,
      };
      delete row.deletedAt; // resurrected remotely
      annotationRows.push(row);
      counts.updated += 1;
    }

    // --- rel marker <-> business object (one live rel per pair — checked
    // against the existing rels below)
    relRows.push({
      annotationId,
      businessObjectId: localObjectId,
    });
  }

  // Resolve the rels to actually write: skip (annotationId, businessObjectId)
  // pairs already live, tombstone the rels of tombstoned annotations.
  const relatedAnnotationIds = [
    ...new Set([...relRows.map((r) => r.annotationId), ...tombstonedAnnotationIds]),
  ];
  const existingRels = relatedAnnotationIds.length
    ? await db.relsBusinessObjectAnnotation
        .where("annotationId")
        .anyOf(relatedAnnotationIds)
        .toArray()
    : [];

  const liveRelKeys = new Set(
    existingRels
      .filter((r) => !r.deletedAt)
      .map((r) => `${r.annotationId}|${r.businessObjectId}`)
  );
  const relRowsToPut = relRows
    .filter((r) => !liveRelKeys.has(`${r.annotationId}|${r.businessObjectId}`))
    .map((r) => ({
      id: nanoid(),
      projectId,
      scopeId: scope.id,
      annotationId: r.annotationId,
      businessObjectId: r.businessObjectId,
      listingId: listing.id,
      createdByUserIdMaster: userIdMaster,
    }));

  const nowIso = new Date().toISOString();
  for (const rel of existingRels) {
    if (rel.deletedAt) continue;
    if (tombstonedAnnotationIds.includes(rel.annotationId)) {
      relRowsToPut.push({ ...rel, deletedAt: nowIso });
    }
  }

  return { annotationRows, pointRows, relRows: relRowsToPut, counts };
}
