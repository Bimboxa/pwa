import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Detail baseMaps of the selected project, as RAW records (no
// BaseMap.createFromRecord): listing them must never trigger their
// on-the-fly PDF render — the row thumbnail is inline on the record.
export default function useDetailBaseMaps() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector(
    (s) => s.entities.entitiesTableUpdatedAt?.["baseMaps"]
  );

  return useLiveQuery(async () => {
    if (!projectId) return [];
    const records = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .toArray();
    return records
      .filter((r) => r.isDetail && !r.deletedAt)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [projectId, baseMapsUpdatedAt]);
}
