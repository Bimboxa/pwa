import planRestoredMeshPaintsSync, {
  getRestoredMeshPaintsHostIds,
  getRestoredMeshPaintsPointIds,
} from "Features/meshPaint/utils/planRestoredMeshPaintsSync";

/**
 * Undo / redo listener (registered by App/db/db.js through
 * undoManager.onUndoRedoApplied): a painted part restored together with its
 * re-stamped host keeps the « à vérifier » state it had at the snapshot time
 * (planRestoredMeshPaintsSync) — its syncedAt is refreshed by a derived
 * write (no audit stamp, no undo entry). Never throws.
 *
 * @param {{db: object, entry: object, direction: "undo"|"redo"}} params
 */
export default async function syncMeshPaintsAfterUndoService({
  db,
  entry,
  direction,
}) {
  if (!db?.meshPaints || !entry) return;
  try {
    const hostIds = getRestoredMeshPaintsHostIds({ entry, direction });
    if (!hostIds.length) return;
    const hosts = (await db.annotations.bulkGet(hostIds)).filter(Boolean);
    const pointIds = getRestoredMeshPaintsPointIds({ entry, direction, hosts });
    const points = pointIds.length ? await db.points.bulkGet(pointIds) : [];
    const ids = planRestoredMeshPaintsSync({
      entry,
      direction,
      hostById: Object.fromEntries(hosts.map((h) => [h.id, h])),
      pointById: Object.fromEntries(
        points.filter(Boolean).map((p) => [p.id, p])
      ),
    });
    if (!ids.length) return;

    await db.transaction("rw", db.meshPaints, async (tx) => {
      tx.derivedWrite = true;
      // After the restore: never earlier than the hosts' re-stamp.
      const now = new Date().toISOString();
      const rows = await db.meshPaints.bulkGet(ids);
      for (const row of rows) {
        if (!row || row.deletedAt) continue;
        await db.meshPaints.update(row.id, {
          sync: { ...(row.sync ?? {}), syncedAt: now },
        });
      }
    });
  } catch (error) {
    console.warn("[syncMeshPaintsAfterUndoService] skipped", error);
  }
}
