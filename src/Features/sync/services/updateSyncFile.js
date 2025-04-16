import db from "App/db/db";

export default async function updateSyncFile(path) {
  try {
    const updatedAt = new Date().toISOString();
    const existing = await db.syncFiles.get(path);

    if (existing) {
      await db.syncFiles.update(path, {updatedAt});
    } else {
      await db.syncFiles.put({
        path,
        updatedAt,
      });
    }
  } catch (e) {
    console.error("[updateSyncFile] Error updating syncFiles:", e);
  }
}
