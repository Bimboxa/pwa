import Dexie from "dexie";

// Deliberately separate from synced project data and existing mesh scan assets.
// One local scan per project/scope. Replacements are atomic; metadata reads do
// not deserialize the source Blob. No upload or project export hooks.
const db = new Dexie("krto-local-scans-v1");
db.version(1).stores({ scans: "contextKey", sources: "contextKey" });

export function getLocalScan(contextKey) {
  return db.scans.get(contextKey);
}
export async function getLocalScanSource(contextKey) {
  return (await db.sources.get(contextKey))?.file;
}
export function saveLocalScan(contextKey, file, info, signal) {
  return db.transaction("rw", db.scans, db.sources, async () => {
    const transaction = Dexie.currentTransaction;
    const abort = () => transaction.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      throw new DOMException("Import cancelled", "AbortError");
    }
    try {
      await db.sources.put({ contextKey, file });
      await db.scans.put({
        contextKey,
        name: file.name,
        size: file.size,
        count: info.count,
        kind: info.kind,
        up: "Z",
        scale: 1,
      });
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  });
}
export function updateLocalScanPlacement(contextKey, placement) {
  return db.scans.update(contextKey, placement);
}
export function deleteLocalScan(contextKey) {
  return db.transaction("rw", db.scans, db.sources, async () => {
    await db.scans.delete(contextKey);
    await db.sources.delete(contextKey);
  });
}

// Legacy scope-local scans remain readable until explicitly reopened as resources.
export async function listLegacyProjectScans(projectId) {
  return (await db.scans.toArray()).filter((row) => {
    try {
      return JSON.parse(row.contextKey)[0] === projectId;
    } catch {
      return false;
    }
  });
}
