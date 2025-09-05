import db from "App/db/db";

export default async function deleteScopeService(scopeId) {
  await db.scopes.delete(scopeId);
}
