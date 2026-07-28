import db from "App/db/db";
import store from "App/store";

import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

/**
 * Upserts the current user's {idMaster ⇔ trigram} row in db.usersDirectory.
 *
 * Called before every Krto zip export (createKrtoZip): the whole table ships
 * in the zip so readers can resolve the private-scope owner label from
 * scope.createdByUserIdMaster, which is the only owner field reliably present
 * on old scopes.
 *
 * No-op when the identity is incomplete (no idMaster or no trigram) — never
 * write partial rows. Identity resolution mirrors
 * usePushRemoteScopeConfiguration: redux userProfile first, debug-auth
 * localStorage as fallback.
 */
export default async function upsertCurrentUserInDirectory() {
  const userProfile = store.getState().auth.userProfile;
  const debugAuth = getDebugAuthFromLocalStorage();

  const idMaster = getUserIdMaster(userProfile) ?? debugAuth?.userIdMaster;
  const trigram = userProfile?.trigram ?? debugAuth?.trigram;

  if (idMaster == null || idMaster === "" || !trigram) return null;

  const row = {
    userIdMaster: String(idMaster),
    trigram,
    ...(userProfile?.firstName ? { firstName: userProfile.firstName } : {}),
    ...(userProfile?.lastName ? { lastName: userProfile.lastName } : {}),
    updatedAt: new Date().toISOString(),
  };

  await db.usersDirectory.put(row);
  return row;
}
