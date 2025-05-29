import db from "App/db/db";
import getInitScopeId from "Features/init/services/getInitScopeId";
import getDateString from "Features/misc/utils/getDateString";

export default async function updateSyncFile({
  path,
  updatedAt,
  syncFileType,
  fileType,
  listingId,
  syncAt,
}) {
  try {
    updatedAt = updatedAt ?? getDateString(new Date());
    const scopeId = getInitScopeId();

    const existing = await db.syncFiles.get(path);

    if (existing) {
      const updates = {};
      if (updatedAt) updates.updatedAt = updatedAt;
      if (syncAt) updates.syncAt = syncAt;
      if (syncFileType) updates.syncFileType = syncFileType;
      if (fileType) updates.fileType = fileType;
      if (listingId) updates.listingId = listingId;

      await db.syncFiles.update(path, updates);
    } else {
      await db.syncFiles.put({
        path,
        syncFileType,
        fileType,
        listingId,
        updatedAt,
        syncAt,
        scopeId,
      });
    }
  } catch (e) {
    console.error("[updateSyncFile] Error updating syncFiles:", e);
  }
}
