import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import getResourceVisibility from "../utils/getResourceVisibility";

// Live list of the resources visible from the selected scope (newest first):
// GLOBAL rows of every project, PROJECT rows (and legacy rows without a
// visibility) of the selected project, and SCOPE rows of the selected scope.
export default function useResources() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const resources = useLiveQuery(async () => {
    if (!projectId) return [];
    const [projectRows, globalRows] = await Promise.all([
      db.resources.where("projectId").equals(projectId).toArray(),
      db.resources.filter((r) => r.visibility === "GLOBAL").toArray(),
    ]);
    const byId = new Map();
    for (const r of [...projectRows, ...globalRows]) {
      if (r.deletedAt) continue;
      const visibility = getResourceVisibility(r);
      if (visibility === "SCOPE" && r.scopeId !== scopeId) continue;
      byId.set(r.id, r);
    }
    return [...byId.values()].sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
  }, [projectId, scopeId]);

  return resources ?? [];
}
