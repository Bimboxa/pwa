import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

/**
 * Live opening relations for the selected project.
 *
 * @returns {{
 *   rows: Array<{id, projectId, hostAnnotationId, openingAnnotationId,
 *     hostSegmentStartPointId, hostSegmentEndPointId, hostArcControlPointId,
 *     hostDistanceM, carve}>,
 *   rowsByHostId: Map<string, Array<Object>>,
 *   rowByOpeningId: Map<string, Object>,
 * }}
 */
export default function useAnnotationOpenings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const rows = useLiveQuery(async () => {
    if (!projectId) return [];
    const all = await db.relAnnotationOpenings
      .where("projectId")
      .equals(projectId)
      .toArray();
    return all.filter((r) => !r.deletedAt);
  }, [projectId]);

  const { rowsByHostId, rowByOpeningId } = useMemo(() => {
    const rowsByHostId = new Map();
    const rowByOpeningId = new Map();
    for (const r of rows ?? []) {
      if (!rowsByHostId.has(r.hostAnnotationId)) {
        rowsByHostId.set(r.hostAnnotationId, []);
      }
      rowsByHostId.get(r.hostAnnotationId).push(r);
      rowByOpeningId.set(r.openingAnnotationId, r);
    }
    return { rowsByHostId, rowByOpeningId };
  }, [rows]);

  return { rows: rows ?? [], rowsByHostId, rowByOpeningId };
}
