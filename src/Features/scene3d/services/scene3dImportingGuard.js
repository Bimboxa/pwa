// Scans being converted right now, or converted and waiting for the zone of
// interest to be validated: their rows sit in db.scene3dAssets with no base
// map referencing them yet. The orphan purge must leave them alone.
//
// Module state (survives the dialog re-renders, not a page reload — a scan
// left over by a reload is purged the next time a scan dialog opens).

const importingSceneIds = new Set();

export function markScene3dImporting(sceneId) {
  importingSceneIds.add(sceneId);
}

export function unmarkScene3dImporting(sceneId) {
  importingSceneIds.delete(sceneId);
}

export function isScene3dImporting(sceneId) {
  return importingSceneIds.has(sceneId);
}
