import {
  MESH_PAINT_STATUS,
  MESH_PAINT_SYNC_STATES,
} from "../constants/meshPaintConstants.js";

import {
  isSameMeshPaintPart,
  prepareMeshPaintMatchItem,
} from "./findMeshPaintMatches.js";
import { getMeshPaintPartTypeForTemplate } from "./meshBrushTools.js";

// Read-time resolution of the painted parts (shared by the 3D layer, the
// quantities and the panel):
//
// - DROPPED (not listed at all): soft-deleted rows, rows whose painting
//   template / its listing / the host is missing or deleted, rows whose
//   template no longer paints this part type (POLYGON ↔ FACE, POLYLINE ↔
//   EDGE), provisional split copies (not re-synced yet);
// - ORPHAN: the re-sync lost the host face / edge (listed, not counted);
// - CONFLICT: the same part painted twice (two devices merged): the newest
//   paint (paintedAt, then createdAt) wins, ties → smaller id. Losers are
//   listed, not counted, not rendered. Never persisted (read time only).
//
// isStale: the host (its row or its points) changed after the last re-sync
// (edited in 2D, or hidden in 3D) — « Quantité à vérifier ».
//
// Lookups (hostById, templateById, listingById, metricsByBaseMapId) may be
// Maps or plain objects. Pure: node-testable.

const lookup = (map, id) => {
  if (!map || id === undefined || id === null) return undefined;
  return typeof map.get === "function" ? map.get(id) : map[id];
};

const toTime = (value) => {
  if (value === undefined || value === null || value === "") return NaN;
  if (typeof value === "number") return value;
  return Date.parse(value);
};

const paintTime = (row) => {
  const t = toTime(row.paintedAt ?? row.createdAt);
  return Number.isFinite(t) ? t : -Infinity;
};

// Winner first: newest paint, then smaller id.
function comparePriority(a, b) {
  const ta = paintTime(a);
  const tb = paintTime(b);
  if (ta !== tb) return tb - ta;
  const ia = String(a.id ?? "");
  const ib = String(b.id ?? "");
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

// Last change of the host's geometry: its row, or any of its db.points rows
// (a 2D vertex drag writes db.points only). `meshPaintPointsUpdatedAt` is
// the newest updatedAt of the host's referenced points, attached by
// useMeshPaints (absent → the row's own time).
export function getMeshPaintHostTime(host) {
  const rowTime = toTime(host?.updatedAt);
  const pointsTime = toTime(host?.meshPaintPointsUpdatedAt);
  if (!Number.isFinite(pointsTime)) return rowTime;
  if (!Number.isFinite(rowTime)) return pointsTime;
  return Math.max(rowTime, pointsTime);
}

export function isMeshPaintStale(row, host) {
  const hostTime = getMeshPaintHostTime(host);
  const refTime = toTime(
    row?.sync?.syncedAt ?? row?.paintedAt ?? row?.createdAt
  );
  if (!Number.isFinite(hostTime) || !Number.isFinite(refTime)) return false;
  return hostTime > refTime;
}

export function isMeshPaintCounted(item) {
  return item?.status === MESH_PAINT_STATUS.OK;
}

export function isMeshPaintListed(item) {
  return Boolean(item);
}

/**
 * @param {object} args
 * @param {object[]} args.rows - db.meshPaints rows
 * @param {Map|Object} args.hostById - raw db.annotations rows
 * @param {Map|Object} args.templateById - raw annotation templates
 * @param {Map|Object} args.listingById - raw listings
 * @param {Map|Object} args.metricsByBaseMapId - {imageWidth, imageHeight,
 *   meterByPx} per base map (conflicts are not detected without them)
 * @returns {{items: Array<{row, status, isStale, host, template}>,
 *   byId: Map<string, object>}} items in input order
 */
export default function resolveMeshPaints({
  rows,
  hostById,
  templateById,
  listingById,
  metricsByBaseMapId,
}) {
  const items = [];
  for (const row of rows || []) {
    if (!row || row.deletedAt) continue;
    if (row.sync?.provisional) continue;
    const template = lookup(templateById, row.annotationTemplateId);
    if (!template || template.deletedAt) continue;
    const listing = lookup(listingById, row.listingId);
    if (!listing || listing.deletedAt) continue;
    const host = lookup(hostById, row.hostAnnotationId);
    if (!host || host.deletedAt) continue;
    if (getMeshPaintPartTypeForTemplate(template) !== row.partType) continue;
    items.push({
      row,
      status:
        row.sync?.state === MESH_PAINT_SYNC_STATES.ORPHAN
          ? MESH_PAINT_STATUS.ORPHAN
          : MESH_PAINT_STATUS.OK,
      isStale: isMeshPaintStale(row, host),
      host,
      template,
    });
  }

  // Conflicts, per scope and base map frame, among the non-orphan items: a
  // duplicated scope paints coincident hosts on the same base map without
  // any conflict with its source scope (paintMeshPartService matches within
  // the scope too).
  const byBaseMap = new Map();
  for (const item of items) {
    if (item.status !== MESH_PAINT_STATUS.OK) continue;
    const key = `${item.row.scopeId ?? ""}|${item.row.baseMapId}`;
    if (!byBaseMap.has(key)) byBaseMap.set(key, []);
    byBaseMap.get(key).push(item);
  }
  for (const group of byBaseMap.values()) {
    if (group.length < 2) continue;
    const metrics = lookup(metricsByBaseMapId, group[0].row.baseMapId);
    if (!metrics) continue;
    const ordered = [...group].sort((a, b) => comparePriority(a.row, b.row));
    const winners = [];
    for (const item of ordered) {
      const prepared = prepareMeshPaintMatchItem(item.row, metrics);
      if (!prepared) continue;
      if (winners.some((winner) => isSameMeshPaintPart(winner, prepared))) {
        item.status = MESH_PAINT_STATUS.CONFLICT;
      } else {
        winners.push(prepared);
      }
    }
  }

  const byId = new Map();
  for (const item of items) byId.set(item.row.id, item);
  return { items, byId };
}
