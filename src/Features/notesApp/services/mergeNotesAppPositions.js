import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import isRemoteNewer from "../utils/isRemoteNewer";

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

// Historical LABEL commit offset: the chip lands 50 image-px left of the
// clicked target (useHandleCommitDrawing). Fallback width when the base map
// image size is unknown.
const LABEL_CHIP_OFFSET_PX = 50;
const FALLBACK_IMAGE_WIDTH = 2000;

// Prepares the notes-app annotations (one optional position per object) for
// one mapped (remote list -> "Ouvrages" listing) pair, following the
// located-business-objects contract:
// - the annotation is issued from one of the LISTING'S OWN annotationTemplates
//   (locationTemplate — created from the appConfig default when the listing
//   has none) and belongs to the businessObjects listing;
// - it is the object's MAIN annotation on its base map: rel
//   { isMain: true, baseMapId } with the same invariants as
//   setMainAnnotationForBusinessObjectService (one live isMain per
//   (object, baseMap) — conflicting rels are demoted, Krnet wins);
// - LABEL geometry is INLINE normalized (targetPoint = Krnet x/y, labelPoint
//   = chip offset), no db.points row involved.
//
// Legacy migration: annotations imported by earlier versions lived as bare
// MARKERs in a companion "Repères" listing (+ db.points). They are force-
// rewritten as LABELs of the businessObjects listing (same id, rels kept),
// whatever their timestamps; orphaned point rows are harmless.
export default async function prepareNotesAppPositionsMerge({
  dump,
  remoteListing,
  listing, // the mapped businessObjects listing
  locationTemplate,
  legacyPositionsListing, // former companion listing, null when absent
  scope,
  projectId,
  userIdMaster,
  objectIdMasterToLocalId,
  baseMapIdMasterToLocalId,
  baseMapWidthByLocalId,
}) {
  const remoteEntities = (dump.entities ?? []).filter(
    (e) => e.listingId === remoteListing.id
  );
  const remoteEntityIds = new Set(remoteEntities.map((e) => e.id));
  const labelByRemoteEntityId = new Map(
    remoteEntities.map((e) => [e.id, e.name])
  );
  const remoteRows = (dump.annotations ?? []).filter((a) =>
    remoteEntityIds.has(a.entityId)
  );

  // --- local annotations index (current listing + legacy companion listing)
  const localRows = (
    await db.annotations.where("listingId").equals(listing.id).toArray()
  ).filter((a) => a.remoteSource === "notesApp" && a.idMaster);
  const legacyRows = legacyPositionsListing
    ? (
        await db.annotations
          .where("listingId")
          .equals(legacyPositionsListing.id)
          .toArray()
      ).filter((a) => a.remoteSource === "notesApp" && a.idMaster)
    : [];
  const localByIdMaster = new Map(
    [...legacyRows, ...localRows].map((a) => [a.idMaster, a])
  );

  // --- rels of the listing, loaded once (pair lookup + isMain conflicts)
  const listingRels = (
    await db.relsBusinessObjectAnnotation
      .where("listingId")
      .equals(listing.id)
      .toArray()
  ).filter((r) => !r.deletedAt);

  const annotationRows = [];
  const relRows = []; // rows to bulkPut (creations, promotions, demotions)
  const relRowsById = new Map(); // dedupe demotions/promotions per rel id
  const putRel = (rel) => {
    relRowsById.set(rel.id, rel);
  };
  const tombstonedAnnotationIds = [];
  const counts = { created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0 };

  const nowIso = new Date().toISOString();

  for (const remote of remoteRows) {
    const local = localByIdMaster.get(remote.id);
    const localIsLegacy = Boolean(
      local && legacyPositionsListing && local.listingId === legacyPositionsListing.id
    );

    // Legacy rows are migrated whatever the timestamps say.
    if (!isRemoteNewer(remote.updatedAt, local) && !localIsLegacy) {
      counts.unchanged += 1;
      continue;
    }

    const updatedAtIso = remote.updatedAt
      ? new Date(remote.updatedAt).toISOString()
      : nowIso;

    // --- tombstone (rels demoted/tombstoned below)
    if (remote.deletedAt) {
      if (!local) {
        counts.unchanged += 1;
        continue;
      }
      annotationRows.push({
        ...local,
        listingId: listing.id,
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

    // --- LABEL geometry: target on the Krnet position, chip 50 image-px
    // left (historical LABEL commit offset), leader stub from the template.
    const width =
      baseMapWidthByLocalId?.get(localBaseMapId) ?? FALLBACK_IMAGE_WIDTH;
    const targetPoint = { x: clamp01(remote.x), y: clamp01(remote.y) };
    const labelPoint = {
      x: clamp01(targetPoint.x - LABEL_CHIP_OFFSET_PX / width),
      y: targetPoint.y,
    };

    const label =
      labelByRemoteEntityId.get(remote.entityId) ?? local?.label ?? "";

    const annotationId = local?.id ?? nanoid();
    const base = local ?? {};
    const row = {
      ...base,
      id: annotationId,
      idMaster: remote.id,
      remoteSource: "notesApp",
      remoteUpdatedAt: remote.updatedAt ?? null,
      type: "LABEL",
      targetPoint,
      labelPoint,
      annotationTemplateId:
        (localIsLegacy ? null : base.annotationTemplateId) ??
        locationTemplate?.id ??
        null,
      listingId: listing.id,
      baseMapId: localBaseMapId,
      projectId,
      label,
      ...(locationTemplate?.fillColor && !base.fillColor
        ? { fillColor: locationTemplate.fillColor }
        : {}),
      createdAt:
        base.createdAt ??
        (remote.createdAt ? new Date(remote.createdAt).toISOString() : updatedAtIso),
      updatedAt: updatedAtIso,
      createdByUserIdMaster: base.createdByUserIdMaster ?? userIdMaster,
    };
    delete row.deletedAt; // resurrected remotely
    delete row.point; // legacy MARKER single-point ref (db.points orphan ok)
    annotationRows.push(row);

    if (!local) counts.created += 1;
    else counts.updated += 1;

    // --- rels: promote/create the pair rel as MAIN on this base map, demote
    // conflicts (same invariants as setMainAnnotationForBusinessObjectService)
    for (const r of listingRels) {
      const samePair =
        r.annotationId === annotationId &&
        r.businessObjectId === localObjectId;
      if (samePair) continue;
      // (a) other main annotation of this object on this base map
      if (
        r.isMain &&
        r.businessObjectId === localObjectId &&
        r.baseMapId === localBaseMapId
      ) {
        putRel({ ...r, isMain: false });
      }
      // (b) this annotation main for another object
      if (r.isMain && r.annotationId === annotationId) {
        putRel({ ...r, isMain: false });
      }
    }
    const pairRel = listingRels.find(
      (r) =>
        r.annotationId === annotationId && r.businessObjectId === localObjectId
    );
    if (pairRel) {
      putRel({ ...pairRel, isMain: true, baseMapId: localBaseMapId });
    } else {
      putRel({
        id: nanoid(),
        projectId,
        scopeId: scope.id,
        annotationId,
        businessObjectId: localObjectId,
        listingId: listing.id,
        isMain: true,
        baseMapId: localBaseMapId,
        createdByUserIdMaster: userIdMaster,
      });
    }
  }

  // --- rels of tombstoned annotations follow their annotation
  for (const r of listingRels) {
    if (tombstonedAnnotationIds.includes(r.annotationId)) {
      putRel({ ...r, deletedAt: nowIso });
    }
  }

  relRows.push(...relRowsById.values());

  return { annotationRows, relRows, counts };
}
