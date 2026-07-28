import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useSelectedScope from "./useSelectedScope";

import db from "App/db/db";
import { getEffectiveOwner, normalizeOwnerId } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

/**
 * Read-only scope state (UI layer).
 *
 * Mirrors the hard guard enforced in the DB layer (getActiveReadOnlyScopeId in
 * App/db/db.js): the selected scope is read-only when it is private
 * (`isPublic !== true`) and the current user is not its creator.
 *
 * @returns {{
 *   isReadOnly: boolean,
 *   scope: object|undefined,
 *   creatorLabel: string // creator trigram (scope field, then usersDirectory), fallback email
 * }}
 */
export default function useReadOnlyScope() {
  const { value: scope } = useSelectedScope();
  const currentUserId = useSelector((state) =>
    getUserIdMaster(state.auth.userProfile)
  );

  const owner = getEffectiveOwner(scope);
  const isReadOnly = Boolean(
    scope &&
      scope.isPublic !== true &&
      owner !== null &&
      owner !== normalizeOwnerId(currentUserId)
  );

  // Owner identity fallback: old scopes miss createdByTrigram/createdBy, but
  // the Krto zip ships a usersDirectory table (idMaster ⇔ trigram, populated
  // on every save) keyed on the same id the ownership guard uses.
  const ownerEntry = useLiveQuery(
    async () => (owner ? db.usersDirectory.get(String(owner)) : undefined),
    [owner]
  );

  const creatorLabel =
    scope?.createdByTrigram ?? ownerEntry?.trigram ?? scope?.createdBy ?? "";

  return { isReadOnly, scope, creatorLabel };
}
