import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

/**
 * Live subtraction relations for the selected project.
 *
 * @returns {{
 *   rows: Array<{id, projectId, sourceAnnotationId, targetAnnotationId}>,
 *   targetIdsBySource: Map<string, string[]>,
 *   relsBySource: Map<string, Array<{id, targetAnnotationId}>>,
 * }}
 */
export default function useAnnotationSubtractions() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const rows = useLiveQuery(async () => {
    if (!projectId) return [];
    const all = await db.relAnnotationSubtractions
      .where("projectId")
      .equals(projectId)
      .toArray();
    return all.filter((r) => !r.deletedAt);
  }, [projectId]);

  const { targetIdsBySource, relsBySource } = useMemo(() => {
    const targetIdsBySource = new Map();
    const relsBySource = new Map();
    for (const r of rows ?? []) {
      if (!targetIdsBySource.has(r.sourceAnnotationId)) {
        targetIdsBySource.set(r.sourceAnnotationId, []);
        relsBySource.set(r.sourceAnnotationId, []);
      }
      targetIdsBySource.get(r.sourceAnnotationId).push(r.targetAnnotationId);
      relsBySource
        .get(r.sourceAnnotationId)
        .push({ id: r.id, targetAnnotationId: r.targetAnnotationId });
    }
    return { targetIdsBySource, relsBySource };
  }, [rows]);

  return { rows: rows ?? [], targetIdsBySource, relsBySource };
}
