import db from "App/db/db";
import getDateString from "Features/misc/utils/getDateString";

export default async function updateSyncFile({
  path,
  updatedAt,
  syncFileType,
  syncAt,
}) {
  try {
    console.log("debug_2104 updateSyncFile path:", path);
    updatedAt = updatedAt ?? getDateString(new Date());
    const existing = await db.syncFiles.get(path);

    if (existing) {
      const updates = {};
      if (updatedAt) updates.updatedAt = updatedAt;
      if (syncAt) updates.syncAt = syncAt;
      if (syncFileType) updates.syncFileType = syncFileType;
      await db.syncFiles.update(path, updates);
    } else {
      await db.syncFiles.put({
        path,
        updatedAt,
        syncFileType,
      });
    }
  } catch (e) {
    console.error("[updateSyncFile] Error updating syncFiles:", e);
  }
}
