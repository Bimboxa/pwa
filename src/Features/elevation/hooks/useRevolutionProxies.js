import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

const EMPTY = { proxies: [], proxyBySourceId: {}, sourceIdByProxyId: {} };

// Live lookup of revolution proxy annotations (plan "donuts") for the current
// project, with both directions of the proxy ↔ source link:
//   - proxyBySourceId[sourceArcId] → proxy annotation
//   - sourceIdByProxyId[proxyId]   → source arc id
export default function useRevolutionProxies() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const data = useLiveQuery(async () => {
    if (!projectId) return EMPTY;
    const rows = (
      await db.annotations.where("projectId").equals(projectId).toArray()
    ).filter((a) => !a.deletedAt && a.isProxy && a.proxySourceAnnotationId);

    const proxyBySourceId = {};
    const sourceIdByProxyId = {};
    for (const p of rows) {
      proxyBySourceId[p.proxySourceAnnotationId] = p;
      sourceIdByProxyId[p.id] = p.proxySourceAnnotationId;
    }
    return { proxies: rows, proxyBySourceId, sourceIdByProxyId };
  }, [projectId, annotationsUpdatedAt]);

  return data ?? EMPTY;
}
