import { useSelector } from "react-redux";

import { isScopeEditor } from "App/db/ownership";
import getUserTrigram from "Features/auth/utils/getUserTrigram";

/**
 * UI mirror of the db-layer editor bypass (isEditorBypassAllowed in db.js):
 * true when the current user's trigram is listed in the selected scope's
 * editorsTrigrams. getUserTrigram runs outside the selectors (it may read
 * localStorage as a debug-auth fallback).
 */
export default function useIsSelectedScopeEditor() {
  const scope = useSelector((s) =>
    s.scopes.selectedScopeId
      ? (s.scopes.scopesById?.[s.scopes.selectedScopeId] ?? null)
      : null
  );
  const userProfile = useSelector((s) => s.auth.userProfile);
  return isScopeEditor(scope, getUserTrigram(userProfile));
}
