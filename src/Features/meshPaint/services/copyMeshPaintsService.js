import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import { normalizedToLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import getAnnotationStrokeWidthPx from "Features/geometry/utils/getAnnotationStrokeWidthPx";
import { getStripDistancePx } from "Features/geometry/utils/getStripePolygons";
import { filterMeshPaintsWritableHere } from "Features/meshPaint/services/meshPaintWriteGuard";
import classifyMeshPaintsForSplit from "Features/meshPaint/utils/classifyMeshPaintsForSplit";
import { isMeshPaintStale } from "Features/meshPaint/utils/resolveMeshPaints";

const isLive = (row) => row && !row.deletedAt;

// Audit / soft-delete fields a copy must not inherit: the db "creating"
// audit hook stamps fresh ones.
const AUDIT_FIELDS = [
  "createdAt",
  "updatedAt",
  "createdByUserIdMaster",
  "updatedByUserIdMaster",
  "deletedAt",
  "deletedByUserIdMaster",
];

/**
 * A copy of a painted part row: fresh id, audit fields dropped, `overrides`
 * applied (hostAnnotationId, scopeId, sync…). paintedAt is kept (conflict
 * arbitration follows the original paint action). Pure (no db).
 *
 * @param {Object} row - db.meshPaints row
 * @param {Object} [overrides]
 * @returns {Object}
 */
export function prepareMeshPaintCopy(row, overrides = {}) {
  const copy = { ...row, id: nanoid(), ...overrides };
  AUDIT_FIELDS.forEach((field) => delete copy[field]);
  return copy;
}

/**
 * Read-time « à vérifier » rule (resolveMeshPaints isStale): the host changed
 * after the paint was last synced. Copies / moved paints keep the flag.
 *
 * @param {Object} row - db.meshPaints row
 * @param {Object} host - db.annotations row
 * @returns {boolean}
 */
export function isMeshPaintStaleForHost(row, host) {
  return isMeshPaintStale(row, host);
}

/**
 * Hosts with `meshPaintPointsUpdatedAt` (newest updatedAt of the db.points
 * they reference) attached, as useMeshPaints does: the « à vérifier » rule
 * (isMeshPaintStale) reads the host's geometry time, points included.
 *
 * @param {Object[]} hosts - db.annotations rows
 * @returns {Promise<Object[]>} same order, copies when augmented
 */
export async function attachMeshPaintPointsUpdatedAt(hosts) {
  const list = hosts ?? [];
  const idsByHost = list.map((h) =>
    h ? [...collectReferencedPointIds([h])] : []
  );
  const pointIds = [...new Set(idsByHost.flat())];
  if (pointIds.length === 0) return list;
  const points = await db.points.bulkGet(pointIds);
  const updatedAtById = new Map();
  points.forEach((p, i) => {
    if (p?.updatedAt) updatedAtById.set(pointIds[i], p.updatedAt);
  });
  return list.map((h, i) => {
    if (!h) return h;
    let newest = null;
    for (const id of idsByHost[i]) {
      const t = updatedAtById.get(id);
      if (t && (!newest || t > newest)) newest = t;
    }
    return newest ? { ...h, meshPaintPointsUpdatedAt: newest } : h;
  });
}

/**
 * Live paints hosted by these annotations.
 *
 * @param {string[]} hostIds
 * @returns {Promise<Object[]>}
 */
export async function getLiveMeshPaintsByHostIds(hostIds) {
  const ids = [...new Set((hostIds ?? []).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await db.meshPaints
    .where("hostAnnotationId")
    .anyOf(ids)
    .toArray();
  return rows.filter(isLive);
}

/**
 * Copies for a scope duplicate: a paint follows only when BOTH its host and
 * its painting template are copied; listing / template / host ids are
 * remapped and the copy lives in the new scope. Pure (no db).
 *
 * The copied hosts are re-stamped (updatedAt = write time) by the audit
 * hook, so a fresh paint copy needs `syncedAt` LATER than that stamp: pass
 * `syncedAt` computed after the hosts were written. A source paint already
 * stale keeps its own syncedAt (the copy stays « à vérifier »).
 *
 * @param {Object} params
 * @param {Object[]} params.rows - live source paints
 * @param {Object<string, string>} params.annotationIdMap - old → new host id
 * @param {Object<string, string>} params.templateIdMap - old → new template id
 * @param {Object<string, string>} params.listingIdMap - old → new listing id
 * @param {Object<string, Object>} [params.sourceHostById] - source hosts (stale rule)
 * @param {string} params.scopeId - new scope id
 * @param {string} params.syncedAt - ISO, after the host copies were written
 * @returns {Object[]} rows ready for bulkAdd
 */
export function buildMeshPaintCopiesForDuplicate({
  rows,
  annotationIdMap,
  templateIdMap,
  listingIdMap,
  sourceHostById = {},
  scopeId,
  syncedAt,
}) {
  return (rows ?? [])
    .filter(
      (r) =>
        isLive(r) &&
        annotationIdMap?.[r.hostAnnotationId] &&
        templateIdMap?.[r.annotationTemplateId]
    )
    .map((r) => {
      const stale = isMeshPaintStaleForHost(
        r,
        sourceHostById[r.hostAnnotationId]
      );
      return prepareMeshPaintCopy(r, {
        scopeId,
        hostAnnotationId: annotationIdMap[r.hostAnnotationId],
        annotationTemplateId: templateIdMap[r.annotationTemplateId],
        listingId: listingIdMap?.[r.listingId] ?? r.listingId,
        sync: {
          ...(r.sync ?? {}),
          syncedAt: stale ? (r.sync?.syncedAt ?? null) : syncedAt,
        },
      });
    });
}

// Frame metrics of a base map record (normalized point ↔ local meters):
// the reference size when the record carries one (versioned base maps).
async function getSplitMetrics(baseMapId) {
  const record = baseMapId ? await db.baseMaps.get(baseMapId) : null;
  if (!record) return null;
  const width =
    Number(record.refWidth) || Number(record.image?.imageSize?.width);
  const height =
    Number(record.refHeight) || Number(record.image?.imageSize?.height);
  const meterByPx = Number(record.meterByPx);
  if (!(width > 0) || !(height > 0) || !(meterByPx > 0)) return null;
  return { imageWidth: width, imageHeight: height, meterByPx };
}

// Plan shape of a split piece (classifyMeshPaintsForSplit), local meters.
async function resolveSplitPiece(annotation, metrics) {
  const resolveRing = async (refs) => {
    const ids = (refs ?? []).map((ref) => ref?.id).filter(Boolean);
    if (ids.length === 0) return [];
    const rows = await db.points.bulkGet(ids);
    return rows
      .filter((p) => p && !p.deletedAt)
      .map((p) => {
        const local = normalizedToLocal([p.x, p.y, 0], metrics);
        return { x: local.x, y: local.y };
      });
  };
  const points = await resolveRing(annotation.points);
  if (annotation.type === "POLYGON") {
    const holes = [];
    for (const cut of annotation.cuts ?? []) {
      const hole = await resolveRing(cut?.points);
      if (hole.length >= 3) holes.push(hole);
    }
    return { hostId: annotation.id, kind: "POLYGON", outline: points, holes };
  }
  // Walls: POLYLINE centred on its line, STRIP band on one side of it.
  const widthM =
    annotation.type === "STRIP"
      ? Math.abs(getStripDistancePx(annotation, metrics.meterByPx)) *
        metrics.meterByPx
      : (getAnnotationStrokeWidthPx(annotation, metrics.meterByPx) *
          metrics.meterByPx) /
        2;
  return {
    hostId: annotation.id,
    kind: "WALL",
    line: points,
    closed: Boolean(annotation.closeLine),
    halfWidthM: Number.isFinite(widthM) ? widthM : 0,
  };
}

/**
 * 2D split of a host into pieces (« Coupe face » 2D cuts, the 2D scissors /
 * polygon split tools): the live paints of the source host are distributed
 * over the pieces from their plan projection (classifyMeshPaintsForSplit):
 * - on the source piece only: kept;
 * - on ONE other piece only (a wall end cap, the front face of a slab cut
 *   parallel to it): RE-HOSTED there (same row, geomHash cleared);
 * - across several pieces: kept on the source, PROVISIONAL copies on the
 *   other pieces holding it — the next re-sync trims each to what its piece
 *   really holds and deletes the copies that match nothing there
 *   (applyMeshPaintsResyncService);
 * - unknown (no metrics / piece geometry): kept + copies on every piece.
 * Every row left on (or moved to) a host gets the one-shot `sync.nearOnly`
 * hint: the next re-sync only looks for it NEAR its old place (Stage 1), so
 * it never jumps onto a new cut face; no match → ORPHAN.
 *
 * Call it AFTER the split writes (the source row holds its piece, the new
 * hosts exist — a missing / deleted one is skipped), inside the caller's
 * withUndoGroup (one Ctrl+Z restores the rows), and never inside a
 * db.transaction that does not include db.meshPaints. User write (audit
 * stamps + undo entries). Paints the selected scope may not write (linked
 * listing, see meshPaintWriteGuard) are left to their own scope.
 *
 * @param {{sourceHostId: string, newHostIds: string[], metrics?: {imageWidth, imageHeight, meterByPx}}} params
 *   metrics: of the host's base map (read from db when omitted).
 * @returns {Promise<{ids: string[], rehostedIds: string[]}>} ids of the
 *   copies, ids of the re-hosted rows
 */
export async function copyMeshPaintsForSplit({
  sourceHostId,
  newHostIds,
  metrics: metricsArg = null,
}) {
  const empty = { ids: [], rehostedIds: [] };
  const targetIds = [...new Set((newHostIds ?? []).filter(Boolean))].filter(
    (id) => id !== sourceHostId
  );
  if (!sourceHostId || targetIds.length === 0) return empty;

  const rows = filterMeshPaintsWritableHere(
    await getLiveMeshPaintsByHostIds([sourceHostId])
  );
  if (rows.length === 0) return empty;

  const hostRows = await db.annotations.bulkGet([sourceHostId, ...targetIds]);
  const source = hostRows[0];
  const targets = hostRows.slice(1).filter((h) => h && !h.deletedAt);
  if (!source || targets.length === 0) return empty;
  const liveTargetIds = new Set(targets.map((h) => h.id));

  let plan;
  try {
    const metrics = metricsArg ?? (await getSplitMetrics(source.baseMapId));
    const pieces = metrics
      ? await Promise.all(
          [source, ...targets].map((h) => resolveSplitPiece(h, metrics))
        )
      : [];
    plan = classifyMeshPaintsForSplit({
      rows,
      metrics,
      sourceHostId,
      pieces,
    });
  } catch (error) {
    console.warn("[copyMeshPaintsForSplit] classification failed", error);
    plan = rows.map((row) => ({ id: row.id, rehostTo: null, copyTo: [] }));
    plan.forEach((entry) => (entry.copyTo = [...liveTargetIds]));
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const updates = [];
  const copies = [];
  const rehostedIds = [];
  for (const entry of plan) {
    const row = rowById.get(entry.id);
    if (!row) continue;
    const baseSync = { ...(row.sync ?? {}) };
    delete baseSync.nearOnly;
    const rehostTo =
      entry.rehostTo && liveTargetIds.has(entry.rehostTo)
        ? entry.rehostTo
        : null;
    if (rehostTo) rehostedIds.push(row.id);
    updates.push({
      key: row.id,
      changes: {
        ...(rehostTo ? { hostAnnotationId: rehostTo } : {}),
        sync: { ...baseSync, geomHash: null, nearOnly: true },
      },
    });
    for (const hostId of entry.copyTo ?? []) {
      if (!liveTargetIds.has(hostId) || hostId === rehostTo) continue;
      copies.push(
        prepareMeshPaintCopy(row, {
          hostAnnotationId: hostId,
          sync: { ...baseSync, provisional: true, geomHash: null },
        })
      );
    }
  }

  await db.transaction("rw", db.meshPaints, async () => {
    for (const { key, changes } of updates) {
      await db.meshPaints.update(key, changes);
    }
    if (copies.length > 0) await db.meshPaints.bulkAdd(copies);
  });

  return { ids: copies.map((c) => c.id), rehostedIds };
}

export default copyMeshPaintsForSplit;
