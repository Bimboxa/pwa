import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Project a scope was opened from, when it is not the scope's own project
// (see scopesSlice.openingSource): the Krto of a linked project opened from
// the dashboard panel of another project. Returns the project row, or null.

export default function useScopeOpeningSourceProject(scope) {
  const openingSource = useSelector((s) => s.scopes.openingSource);

  const sourceProjectId =
    scope?.id &&
    openingSource?.scopeId === scope.id &&
    openingSource.projectId !== scope.projectId
      ? openingSource.projectId
      : null;

  const project = useLiveQuery(async () => {
    if (!sourceProjectId) return null;
    const row = await db.projects.get(sourceProjectId);
    return row && !row.deletedAt ? row : null;
  }, [sourceProjectId]);

  return sourceProjectId ? (project ?? null) : null;
}
