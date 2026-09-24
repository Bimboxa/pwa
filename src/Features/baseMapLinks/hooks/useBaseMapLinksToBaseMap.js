import { useLiveQuery } from "dexie-react-hooks";
import { useSelector } from "react-redux";

import db from "App/db/db";

// BASE_MAP_LINK section marks (drawn on plans) that target the given base
// map, each paired with its clone drawn ON that base map (if any).
//
// Read straight from Dexie — not through useAnnotationsV2 — so a hidden clone
// (record-level `hidden`, filtered out of the rendered annotations) stays
// reachable from the panel row that toggles its eye.
//
// Returns [{ link, clone }], links first by creation order.
export default function useBaseMapLinksToBaseMap(baseMapId) {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const items = useLiveQuery(async () => {
    if (!projectId || !baseMapId) return [];
    const rows = await db.annotations
      .where("projectId")
      .equals(projectId)
      .filter((a) => !a.deletedAt && a.type === "BASE_MAP_LINK")
      .toArray();

    const links = rows
      .filter(
        (a) => !a.sourceLinkAnnotationId && a.linkedBaseMapId === baseMapId
      )
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    if (links.length === 0) return [];

    const linkIds = new Set(links.map((a) => a.id));
    // One live clone per (link, base map) by construction; keep the newest
    // if the invariant was ever broken.
    const cloneBySourceId = {};
    for (const a of rows) {
      if (!a.sourceLinkAnnotationId || a.baseMapId !== baseMapId) continue;
      if (!linkIds.has(a.sourceLinkAnnotationId)) continue;
      const prev = cloneBySourceId[a.sourceLinkAnnotationId];
      if (!prev || (a.createdAt ?? 0) >= (prev.createdAt ?? 0))
        cloneBySourceId[a.sourceLinkAnnotationId] = a;
    }
    return links.map((link) => ({
      link,
      clone: cloneBySourceId[link.id] ?? null,
    }));
  }, [projectId, baseMapId, annotationsUpdatedAt]);

  return items ?? [];
}
