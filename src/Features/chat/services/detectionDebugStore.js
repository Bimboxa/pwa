import Dexie from "dexie";

// Local diagnostics only: separate from synced business data and undo history.
export const detectionDebugDb = new Dexie("krto-chat-detection-debug");
detectionDebugDb.version(1).stores({ artifacts: "id, archiveKey, createdAt" });
export const MAX_DEBUG_ARTIFACTS = 30;

export function detectionArchiveKey(ownerId, projectId, baseMapId) {
  return ownerId != null && ownerId !== "" && projectId && baseMapId
    ? JSON.stringify([String(ownerId), projectId, baseMapId])
    : null;
}

export async function saveDetectionDebug(record, db = detectionDebugDb) {
  if (!record.archiveKey)
    throw new Error(
      "Contexte utilisateur ou plan absent : copie disponible uniquement dans ce chat."
    );
  await db.transaction("rw", db.artifacts, async () => {
    await db.artifacts.put(record);
    const rows = await db.artifacts
      .where("archiveKey")
      .equals(record.archiveKey)
      .sortBy("createdAt");
    await db.artifacts.bulkDelete(
      rows
        .slice(0, Math.max(0, rows.length - MAX_DEBUG_ARTIFACTS))
        .map((row) => row.id)
    );
  });
}

export function listDetectionDebug(archiveKey, db = detectionDebugDb) {
  if (!archiveKey) return Promise.resolve([]);
  return db.artifacts
    .where("archiveKey")
    .equals(archiveKey)
    .reverse()
    .sortBy("createdAt");
}
