import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

// Counts of non-deleted annotations per baseMapId for the selected project —
// {baseMapId: count}. Same read semantics as the duplicate-scope counts
// (useDuplicateScopeSourceData): raw per-basemap totals, no scope filtering.
export default function useAnnotationsCountByBaseMapId() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const value = useLiveQuery(async () => {
    if (!projectId) return {};
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .toArray();
    const counts = {};
    rows.forEach((a) => {
      if (a.deletedAt || !a.baseMapId) return;
      counts[a.baseMapId] = (counts[a.baseMapId] ?? 0) + 1;
    });
    return counts;
  }, [projectId]);

  return value ?? {};
}
