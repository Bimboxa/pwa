import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live ordered list of POVs for the selected project + scope, excluding
// soft-deleted records, sorted by fractional sortIndex.
export default function usePovs() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  return useLiveQuery(async () => {
    if (!projectId || !scopeId) return [];
    const records = await db.povs
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    return records
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (a.sortIndex ?? "").localeCompare(b.sortIndex ?? ""));
  }, [projectId, scopeId]);
}
