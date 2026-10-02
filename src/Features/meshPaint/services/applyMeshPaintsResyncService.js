import db from "App/db/db";
import store from "App/store";

import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

// Re-sync writes are DERIVED writes (tx.derivedWrite, see db.js): a refresh
// computed from the host geometry, not a user edit — no audit stamp (a
// background refresh must never win a Krto "newest wins" merge over a user
// edit), no dirty flag, no undo entry. A derived deletion is an update of
// deletedAt (the soft-delete middleware would push an undo entry).

function getDeletedByUserIdMaster() {
  const id = getUserIdMaster(store.getState()?.auth?.userProfile);
  return id != null ? String(id) : "anonymous";
}

const isLive = (row) => row && !row.deletedAt;

// sync object after a re-sync pass (provisional dropped once matched, the
// one-shot split hint `nearOnly` dropped by the pass that honoured it).
function buildNextSync(row, change, geomHash, now) {
  const next = {
    ...(row.sync ?? {}),
    state: change.state,
    geomHash: geomHash ?? null,
    syncedAt: now,
  };
  if (change.clearProvisional) delete next.provisional;
  if (change.clearNearOnly) delete next.nearOnly;
  return next;
}

/**
 * Applies a planPaintResync result for ONE host.
 *
 * Per change: a provisional copy that matched nothing (deleteProvisional) is
 * soft-deleted; any other row is written only when something differs — the
 * geometry moved (change.changed), the state, the stored hash or the
 * provisional flag — so reopening the 3D view on an unchanged host writes
 * nothing. Rows deleted meanwhile, or hosted elsewhere, are skipped.
 *
 * Never throws (a read-only scope makes the db guards throw): errors are
 * logged and returned.
 *
 * @param {Object} params
 * @param {string} params.hostId
 * @param {Array<{id: string, geometry: Object, state: "OK"|"ORPHAN", changed: boolean, clearProvisional: boolean, clearNearOnly?: boolean, deleteProvisional: boolean}>} params.changes
 *   planPaintResync output.
 * @param {string|null} params.geomHash - hash of the host geometry the plan was computed on.
 * @returns {Promise<{written: number, deleted: number, error?: Error}>}
 */
export default async function applyMeshPaintsResyncService({
  hostId,
  changes,
  geomHash,
}) {
  const list = (changes ?? []).filter((c) => c?.id);
  if (list.length === 0) return { written: 0, deleted: 0 };

  try {
    return await db.transaction("rw", db.meshPaints, async (tx) => {
      tx.derivedWrite = true;

      const now = new Date().toISOString();
      const rows = await db.meshPaints.bulkGet(list.map((c) => c.id));
      let written = 0;
      let deleted = 0;

      for (let i = 0; i < list.length; i++) {
        const change = list[i];
        const row = rows[i];
        if (!isLive(row)) continue;
        if (hostId && row.hostAnnotationId !== hostId) continue;

        if (change.deleteProvisional) {
          if (!row.sync?.provisional) continue; // never delete a user row
          await db.meshPaints.update(row.id, {
            deletedAt: now,
            deletedByUserIdMaster: getDeletedByUserIdMaster(),
          });
          deleted += 1;
          continue;
        }

        const stateChanged = (row.sync?.state ?? null) !== change.state;
        const hashChanged = (row.sync?.geomHash ?? null) !== (geomHash ?? null);
        const provisionalChanged =
          Boolean(change.clearProvisional) && Boolean(row.sync?.provisional);
        const nearOnlyChanged =
          Boolean(change.clearNearOnly) && Boolean(row.sync?.nearOnly);
        const geometryChanged = Boolean(change.changed && change.geometry);
        if (
          !geometryChanged &&
          !stateChanged &&
          !hashChanged &&
          !provisionalChanged &&
          !nearOnlyChanged
        ) {
          continue;
        }

        await db.meshPaints.update(row.id, {
          ...(geometryChanged ? { geometry: change.geometry } : {}),
          sync: buildNextSync(row, change, geomHash, now),
        });
        written += 1;
      }

      return { written, deleted };
    });
  } catch (error) {
    console.warn("[applyMeshPaintsResyncService] skipped", hostId, error);
    return { written: 0, deleted: 0, error };
  }
}

/**
 * Clears the « à vérifier » badge (host.updatedAt > sync.syncedAt) of paints
 * whose host geometry hash did NOT change: derived write of sync.syncedAt
 * only. Never throws.
 *
 * @param {{ids: string[]}} params
 * @returns {Promise<{written: number, error?: Error}>}
 */
export async function touchMeshPaintsSyncedAt({ ids }) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))];
  if (uniqueIds.length === 0) return { written: 0 };

  try {
    return await db.transaction("rw", db.meshPaints, async (tx) => {
      tx.derivedWrite = true;

      const now = new Date().toISOString();
      const rows = await db.meshPaints.bulkGet(uniqueIds);
      let written = 0;
      for (const row of rows) {
        if (!isLive(row)) continue;
        await db.meshPaints.update(row.id, {
          sync: { ...(row.sync ?? {}), syncedAt: now },
        });
        written += 1;
      }
      return { written };
    });
  } catch (error) {
    console.warn("[touchMeshPaintsSyncedAt] skipped", error);
    return { written: 0, error };
  }
}
