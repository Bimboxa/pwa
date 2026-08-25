import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

/**
 * Live subtraction relations for the selected project.
 *
 * Indexed both ways: *BySource answers "what is subtracted from me?", *ByTarget
 * answers "which annotations am I carved out of?" (reverse pick mode + the
 * "Soustraite de" panel section).
 *
 * @returns {{
 *   rows: Array<{id, projectId, sourceAnnotationId, targetAnnotationId}>,
 *   targetIdsBySource: Map<string, string[]>,
 *   relsBySource: Map<string, Array<{id, targetAnnotationId}>>,
 *   sourceIdsByTarget: Map<string, string[]>,
 *   relsByTarget: Map<string, Array<{id, sourceAnnotationId}>>,
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

  const { targetIdsBySource, relsBySource, sourceIdsByTarget, relsByTarget } =
    useMemo(() => {
      const targetIdsBySource = new Map();
      const relsBySource = new Map();
      const sourceIdsByTarget = new Map();
      const relsByTarget = new Map();
      for (const r of rows ?? []) {
        if (!targetIdsBySource.has(r.sourceAnnotationId)) {
          targetIdsBySource.set(r.sourceAnnotationId, []);
          relsBySource.set(r.sourceAnnotationId, []);
        }
        targetIdsBySource.get(r.sourceAnnotationId).push(r.targetAnnotationId);
        relsBySource
          .get(r.sourceAnnotationId)
          .push({ id: r.id, targetAnnotationId: r.targetAnnotationId });

        if (!sourceIdsByTarget.has(r.targetAnnotationId)) {
          sourceIdsByTarget.set(r.targetAnnotationId, []);
          relsByTarget.set(r.targetAnnotationId, []);
        }
        sourceIdsByTarget.get(r.targetAnnotationId).push(r.sourceAnnotationId);
        relsByTarget
          .get(r.targetAnnotationId)
          .push({ id: r.id, sourceAnnotationId: r.sourceAnnotationId });
      }
      return {
        targetIdsBySource,
        relsBySource,
        sourceIdsByTarget,
        relsByTarget,
      };
    }, [rows]);

  return {
    rows: rows ?? [],
    targetIdsBySource,
    relsBySource,
    sourceIdsByTarget,
    relsByTarget,
  };
}
