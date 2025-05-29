import db from "App/db/db";

export default async function deleteSyncFiles(scopeId) {
  await db.syncFiles.where("scopeId").equals(scopeId).delete();
}
