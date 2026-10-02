import collectReferencedPointIds from "../../annotations/utils/collectReferencedPointIds.js";

// Undo / redo re-stamps the restored annotations / points (a user edit,
// undoManager getRestoreValue) but restores a painted part's own
// sync.syncedAt: a paint restored TOGETHER with its host (2D / 3D move, 2D
// split, delete cascade) would then read « à vérifier » although both came
// back as they were. This plan keeps the « à vérifier » relation of the
// restored snapshot: a restored paint that was in sync with its host at the
// snapshot time gets its syncedAt refreshed after the restore; one that was
// already stale stays stale.
//
// Host time at the snapshot = the newest updatedAt of the host row and of
// its points, each taken from the undo entry when it is part of it (its
// restored snapshot), else from the current row.
//
// Pure: node-testable.

const toTime = (value) => {
  if (value === undefined || value === null || value === "") return NaN;
  return typeof value === "number" ? value : Date.parse(value);
};

function flatten(entry, out = []) {
  if (!entry) return out;
  if (entry.type === "group") {
    for (const child of entry.entries ?? []) flatten(child, out);
  } else {
    out.push(entry);
  }
  return out;
}

/**
 * @param {object} args
 * @param {object} args.entry - the undo entry just applied (group or single)
 * @param {"undo"|"redo"} args.direction
 * @param {Object<string, Object>|Map} args.hostById - current db rows of the
 *   restored paints' hosts
 * @param {Object<string, Object>|Map} args.pointById - current db rows of
 *   their points
 * @returns {string[]} ids of the paints whose syncedAt must be refreshed
 */
export default function planRestoredMeshPaintsSync({
  entry,
  direction,
  hostById,
  pointById,
}) {
  const get = (map, id) =>
    typeof map?.get === "function" ? map.get(id) : map?.[id];
  const entries = flatten(entry);
  const snapshot = (e) => (direction === "undo" ? e.before : e.after);

  const paints = entries
    .filter((e) => e.table === "meshPaints")
    .map(snapshot)
    .filter((row) => row && !row.deletedAt && row.sync);
  if (!paints.length) return [];
  // Nothing re-stamped: the paints' own relation is untouched.
  if (!entries.some((e) => e.table === "annotations" || e.table === "points")) {
    return [];
  }

  const hostSnapshots = new Map();
  const pointSnapshots = new Map();
  for (const e of entries) {
    if (e.table === "annotations") hostSnapshots.set(e.key, snapshot(e));
    if (e.table === "points") pointSnapshots.set(e.key, snapshot(e));
  }

  const ids = [];
  for (const paint of paints) {
    const host = hostSnapshots.has(paint.hostAnnotationId)
      ? hostSnapshots.get(paint.hostAnnotationId)
      : get(hostById, paint.hostAnnotationId);
    if (!host) continue;
    let hostTime = toTime(host.updatedAt);
    for (const pointId of collectReferencedPointIds([host])) {
      const point = pointSnapshots.has(pointId)
        ? pointSnapshots.get(pointId)
        : get(pointById, pointId);
      const t = toTime(point?.updatedAt);
      if (Number.isFinite(t) && !(t <= hostTime)) hostTime = t;
    }
    const syncedAt = toTime(
      paint.sync.syncedAt ?? paint.paintedAt ?? paint.createdAt
    );
    if (!Number.isFinite(syncedAt)) continue;
    if (Number.isFinite(hostTime) && hostTime > syncedAt) continue; // stale
    ids.push(paint.id);
  }
  return ids;
}

/**
 * Hosts a plan needs from the db (ids of the restored paints' hosts), and
 * the points it needs once those hosts are read.
 */
export function getRestoredMeshPaintsHostIds({ entry, direction }) {
  const snapshot = (e) => (direction === "undo" ? e.before : e.after);
  const hostIds = new Set();
  for (const e of flatten(entry)) {
    if (e.table !== "meshPaints") continue;
    const row = snapshot(e);
    if (row?.hostAnnotationId) hostIds.add(row.hostAnnotationId);
  }
  return [...hostIds];
}

export function getRestoredMeshPaintsPointIds({ entry, direction, hosts }) {
  const snapshot = (e) => (direction === "undo" ? e.before : e.after);
  const annotations = [
    ...(hosts ?? []),
    ...flatten(entry)
      .filter((e) => e.table === "annotations")
      .map(snapshot),
  ].filter(Boolean);
  return [...collectReferencedPointIds(annotations)];
}
