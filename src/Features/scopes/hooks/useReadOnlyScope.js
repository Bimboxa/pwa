import { useSelector } from "react-redux";

import useSelectedScope from "./useSelectedScope";

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
 *   creatorLabel: string // creator trigram, fallback email
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

  const creatorLabel = scope?.createdByTrigram ?? scope?.createdBy ?? "";

  return { isReadOnly, scope, creatorLabel };
}
