import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import isRemoteNewer from "../utils/isRemoteNewer";
import {
  isShapeType,
  mapNotesAppShapeToAnnotation,
} from "../utils/mapNotesAppShapeToAnnotation";

// Prepares the Krnet drawings (POLYLINE / POLYGON annotations, N-N linked to
// objects through rels_entity_annotation) of one mapped (remote list ->
// "Ouvrages" listing) pair:
// - a shape belongs to the pair when its Krnet listing_id is the remote list,
//   or (listing_id null) when one of its rels points at an object of the
//   pair; `claimedShapeIds` (shared across pairs by the orchestrator) keeps
//   the first claiming pair as owner;
// - the annotation is issued from the listing's own POLYLINE / POLYGON
//   template (templatesByShape), geometry = FRESH db.points rows on every
//   write (previous points stay as orphans, POINTS_STORAGE.md rule), label =
//   the linked object's label (main first), shown as a chip;
// - remote signature = max(annotation, rels, linked entities updatedAt): a
//   rename of the object does not bump the Krnet annotation row;
// - rels: one local rel per (annotation, object) pair carrying the Krnet rel
//   id as idMaster; Krnet `is_main` is honoured only when no live main rel
//   exists for (object, base map) after the positions pass (a Krnet MARKER
//   is by definition the position), else the rel is plain. The rels context
//   ({ listingRels, relRowsById }) comes from the positions merge so both
//   passes see each other's promotions; the orchestrator writes
//   relRowsById once.
export default async function prepareNotesAppShapesMerge({
  dump,
  remoteListing,
  listing, // the mapped businessObjects listing
  templatesByShape,
  scope,
  projectId,
  userIdMaster,
  objectIdMasterToLocalId,
  baseMapIdMasterToLocalId,
  claimedShapeIds,
  relsContext, // { listingRels, relRowsById } from the positions merge
}) {
  const remoteEntities = (dump.entities ?? []).filter(
    (e) => e.listingId === remoteListing.id
  );
  const remoteEntityIds = new Set(remoteEntities.map((e) => e.id));
  const remoteEntityById = new Map(remoteEntities.map((e) => [e.id, e]));

  // --- remote rels by annotation id (tombstones included for the signature)
  const relsByAnnotationId = new Map();
  for (const rel of dump.relsEntityAnnotation ?? []) {
    if (!rel?.annotationId) continue;
    const list = relsByAnnotationId.get(rel.annotationId) ?? [];
    list.push(rel);
    relsByAnnotationId.set(rel.annotationId, list);
  }

  const remoteRows = (dump.annotations ?? []).filter((a) => {
    if (!isShapeType(a.type)) return false;
    if (claimedShapeIds?.has(a.id)) return false;
    if (a.listingId === remoteListing.id) return true;
    if (a.listingId) return false;
    return (relsByAnnotationId.get(a.id) ?? []).some(
      (r) => !r.deletedAt && remoteEntityIds.has(r.entityId)
    );
  });
  for (const a of remoteRows) claimedShapeIds?.add(a.id);

  // --- local shapes index
  const localRows = (
    await db.annotations.where("listingId").equals(listing.id).toArray()
  ).filter(
    (a) => a.remoteSource === "notesApp" && a.idMaster && isShapeType(a.type)
  );
  const localByIdMaster = new Map(localRows.map((a) => [a.idMaster, a]));

  // --- rels context (shared with the positions merge)
  const listingRels =
    relsContext?.listingRels ??
    (
      await db.relsBusinessObjectAnnotation
        .where("listingId")
        .equals(listing.id)
        .toArray()
    ).filter((r) => !r.deletedAt);
  const relRowsById = relsContext?.relRowsById ?? new Map();
  const currentRel = (r) => relRowsById.get(r.id) ?? r;
  const putRel = (rel) => relRowsById.set(rel.id, rel);
  const liveRels = () =>
    [
      ...new Map(
        [...listingRels, ...relRowsById.values()].map((r) => [r.id, r])
      ).values(),
    ]
      .map(currentRel)
      .filter((r) => !r.deletedAt);

  const annotationRows = [];
  const pointRows = [];
  const counts = {
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    skipped: 0,
  };
  const nowIso = new Date().toISOString();

  for (const remote of remoteRows) {
    const local = localByIdMaster.get(remote.id);
    const rels = relsByAnnotationId.get(remote.id) ?? [];
    const liveRemoteRels = rels.filter((r) => !r.deletedAt);

    // --- signature: annotation + rels + linked entities
    let signature = remote.updatedAt ?? 0;
    for (const r of rels) {
      signature = Math.max(signature, r.updatedAt ?? 0);
      const entity = remoteEntityById.get(r.entityId);
      if (entity) signature = Math.max(signature, entity.updatedAt ?? 0);
    }
    if (!isRemoteNewer(signature, local)) {
      counts.unchanged += 1;
      continue;
    }

    const updatedAtIso = signature ? new Date(signature).toISOString() : nowIso;

    // --- tombstone (rels follow)
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
      for (const r of listingRels) {
        if (r.annotationId === local.id)
          putRel({ ...currentRel(r), deletedAt: nowIso });
      }
      counts.deleted += 1;
      continue;
    }

    const localBaseMapId = baseMapIdMasterToLocalId.get(remote.baseMapId);
    if (!localBaseMapId) {
      // plan ignored or skipped (missing image)
      counts.skipped += 1;
      continue;
    }

    // --- linked objects (main first) resolved to local ids
    const linked = liveRemoteRels
      .filter((r) => remoteEntityIds.has(r.entityId))
      .sort((a, b) => Number(Boolean(b.isMain)) - Number(Boolean(a.isMain)))
      .map((r) => ({
        rel: r,
        localObjectId: objectIdMasterToLocalId.get(r.entityId),
        entity: remoteEntityById.get(r.entityId),
      }))
      .filter((x) => x.localObjectId);
    const label =
      linked[0]?.entity?.name ?? local?.label ?? remote.settings?.label ?? "";

    const mapped = mapNotesAppShapeToAnnotation({
      remote,
      base: local,
      template: templatesByShape?.[remote.type],
      label,
      listingId: listing.id,
      baseMapId: localBaseMapId,
      projectId,
      scopeId: scope.id,
      userIdMaster,
      updatedAtIso,
      nowIso,
    });
    if (!mapped) {
      counts.skipped += 1;
      continue;
    }
    annotationRows.push(mapped.row);
    pointRows.push(...mapped.pointRows);
    const annotationId = mapped.row.id;
    if (!local) counts.created += 1;
    else counts.updated += 1;

    // --- rels of this annotation: keep the linked pairs, tombstone the rest
    const keptRelIds = new Set();
    for (const { rel: remoteRel, localObjectId } of linked) {
      const live = liveRels();
      const pairRel = live.find(
        (r) =>
          r.annotationId === annotationId &&
          r.businessObjectId === localObjectId
      );
      const wantsMain = Boolean(remoteRel.isMain);
      const otherMainExists = live.some(
        (r) =>
          r.isMain &&
          r.businessObjectId === localObjectId &&
          r.baseMapId === localBaseMapId &&
          r.annotationId !== annotationId
      );
      const asMain = wantsMain && !otherMainExists;
      let row;
      if (pairRel) {
        row = { ...pairRel, idMaster: remoteRel.id };
        if (asMain) {
          row.isMain = true;
          row.baseMapId = localBaseMapId;
        } else if (pairRel.isMain) {
          row.isMain = false;
        }
      } else {
        row = {
          id: nanoid(),
          idMaster: remoteRel.id,
          projectId,
          scopeId: scope.id,
          annotationId,
          businessObjectId: localObjectId,
          listingId: listing.id,
          ...(asMain && { isMain: true, baseMapId: localBaseMapId }),
          createdByUserIdMaster: userIdMaster,
        };
      }
      if (asMain) {
        // (b) this annotation main for another object
        for (const r of live) {
          if (r.isMain && r.annotationId === annotationId && r.id !== row.id) {
            putRel({ ...r, isMain: false });
          }
        }
      }
      putRel(row);
      keptRelIds.add(row.id);
    }
    for (const r of listingRels) {
      const cur = currentRel(r);
      if (
        cur.annotationId === annotationId &&
        !keptRelIds.has(cur.id) &&
        !cur.deletedAt
      ) {
        putRel({ ...cur, deletedAt: nowIso });
      }
    }
  }

  return { annotationRows, pointRows, relRowsById, listingRels, counts };
}
