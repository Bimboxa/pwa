import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import {
  getNotesAppScopeLink,
  linkScopeToNotesAppProject,
  unlinkScopeFromNotesAppProject,
  setNotesAppListingMapping,
} from "../utils/resolveNotesAppScopeLink";

// Selected scope + its notes-app link (scope.notesApp) + write helpers.
// The scopes table is live-synced into Redux (dexieSyncService), so the link
// updates propagate here automatically after a write.
export default function useNotesAppScopeLink() {
  const { value: scope } = useSelectedScope();
  const link = getNotesAppScopeLink(scope);

  const linkProject = async ({ projectId, projectName }) => {
    if (!scope?.id) return;
    await linkScopeToNotesAppProject({ scopeId: scope.id, projectId, projectName });
  };

  const unlinkProject = async () => {
    if (!scope?.id) return;
    await unlinkScopeFromNotesAppProject(scope.id);
  };

  const setListingMapping = async (entry) => {
    if (!scope?.id) return;
    await setNotesAppListingMapping({ scope, ...entry });
  };

  return { scope, link, linkProject, unlinkProject, setListingMapping };
}
