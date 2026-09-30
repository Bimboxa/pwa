import deleteScene3dAssetsService from "./deleteScene3dAssetsService";

// Scans imported but not placed yet: between the import dialog and the click
// that creates the annotation, the scan data already sits in
// db.scene3dAssets but nothing references it. This store keeps, per sceneId,
// what the commit needs (the top view Blob) and what the placement ghost
// needs (its object URL). A scan that leaves the store without being
// committed (tool disarmed, another import started) is deleted.
//
// Module state, not Redux: Blobs are not serializable.

const pendingBySceneId = new Map();

// Scans being converted right now (rows written, no annotation yet): the
// orphan purge must leave them alone.
const importingSceneIds = new Set();

export function markScene3dImporting(sceneId) {
  importingSceneIds.add(sceneId);
}

export function unmarkScene3dImporting(sceneId) {
  importingSceneIds.delete(sceneId);
}

// topView: {blob, fileMime, width, height, pxPerMeter}
export function addPendingScene3d(sceneId, topView) {
  pendingBySceneId.set(sceneId, {
    topView,
    topViewUrl: URL.createObjectURL(topView.blob),
  });
}

export function getPendingScene3d(sceneId) {
  return pendingBySceneId.get(sceneId) ?? null;
}

// True while the scan is not (yet) owned by an annotation on purpose.
export function isPendingScene3d(sceneId) {
  return pendingBySceneId.has(sceneId) || importingSceneIds.has(sceneId);
}

// Commit: the annotation takes ownership of the scan. → topView | null
export function takePendingScene3d(sceneId) {
  const pending = pendingBySceneId.get(sceneId);
  if (!pending) return null;
  pendingBySceneId.delete(sceneId);
  URL.revokeObjectURL(pending.topViewUrl);
  return pending.topView;
}

// Deletes every pending scan but `keepSceneId` (the one being placed).
export async function discardPendingScenes3d(keepSceneId) {
  const sceneIds = [...pendingBySceneId.keys()].filter(
    (sceneId) => sceneId !== keepSceneId
  );
  for (const sceneId of sceneIds) {
    const pending = pendingBySceneId.get(sceneId);
    pendingBySceneId.delete(sceneId);
    URL.revokeObjectURL(pending.topViewUrl);
    try {
      await deleteScene3dAssetsService(sceneId);
    } catch (error) {
      console.error("[scene3d] failed to discard a pending scan", error);
    }
  }
}
