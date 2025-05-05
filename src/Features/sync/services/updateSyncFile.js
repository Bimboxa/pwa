import db from "App/db/db";
import getInitScopeId from "Features/init/services/getInitScopeId";
import getDateString from "Features/misc/utils/getDateString";

export default async function updateSyncFile({
  path,
  updatedAt,
  itemType,
  syncAt,
}) {
  try {
    updatedAt = updatedAt ?? getDateString(new Date());
    const scopeId = getInitScopeId();

    console.log("debug_2104 updateSyncFile", path, itemType, updatedAt, syncAt);

    const existing = await db.syncFiles.get(path);

    if (existing) {
      const updates = {};
      if (updatedAt) updates.updatedAt = updatedAt;
      if (syncAt) updates.syncAt = syncAt;
      if (itemType) updates.itemType = itemType;
      await db.syncFiles.update(path, updates);
    } else {
      await db.syncFiles.put({
        path,
        itemType,
        updatedAt,
        syncAt,
        scopeId,
      });
    }
  } catch (e) {
    console.error("[updateSyncFile] Error updating syncFiles:", e);
  }
}
