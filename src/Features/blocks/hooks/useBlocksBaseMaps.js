import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Blocks base maps of the selected project, as RAW records (no
// BaseMap.createFromRecord), sorted by name.
export default function useBlocksBaseMaps() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMapsUpdatedAt = useSelector(
    (s) => s.entities.entitiesTableUpdatedAt?.["baseMaps"]
  );

  // main

  return useLiveQuery(async () => {
    if (!projectId) return [];
    const records = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .toArray();
    return records
      .filter((r) => r.isBlocksBaseMap && !r.deletedAt)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [projectId, baseMapsUpdatedAt]);
}
