import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

// Live mesh-cell relations for the selected project: links each parent
// annotation to its mesh cell children ("maillage"). Mirrors
// useAnnotationSubtractions.
//
// Returns:
//   - rows: the raw relation rows
//   - cellIdsByParent: Map<parentAnnotationId, meshCellAnnotationId[]>
//   - parentIdSet: Set of annotation ids that have at least one mesh cell
export default function useMeshCellRelations() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const rows = useLiveQuery(async () => {
    if (!projectId) return [];
    const all = await db.relAnnotationMeshCells
      .where("projectId")
      .equals(projectId)
      .toArray();
    return all.filter((r) => !r.deletedAt);
  }, [projectId]);

  return useMemo(() => {
    const cellIdsByParent = new Map();
    const parentIdSet = new Set();
    for (const r of rows ?? []) {
      if (!cellIdsByParent.has(r.parentAnnotationId)) {
        cellIdsByParent.set(r.parentAnnotationId, []);
      }
      cellIdsByParent.get(r.parentAnnotationId).push(r.meshCellAnnotationId);
      parentIdSet.add(r.parentAnnotationId);
    }
    return { rows: rows ?? [], cellIdsByParent, parentIdSet };
  }, [rows]);
}
