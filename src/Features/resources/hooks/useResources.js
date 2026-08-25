import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live list of the selected project's resources (newest first).
export default function useResources() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const resources = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.resources
      .where("projectId")
      .equals(projectId)
      .toArray();
    return rows
      .filter((r) => !r.deletedAt)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [projectId]);

  return resources ?? [];
}
