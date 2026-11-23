import { useEffect } from "react";

import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import bindSeededCommentsService from "../services/bindSeededCommentsService";

// Keeps the infos seeded by a configuration bound to their targets: while
// some of the displayed comments still hold unresolved keys
// (seedRefs.pending), the binding runs again each time a base map or an
// annotation template appears in the project — e.g. right after a procedure
// created the pages the infos point to — so their pins and action blocks
// follow without opening them.
export default function useBindSeededComments(comments) {
  const pendingComment = (comments ?? []).find((c) => c.seedRefs?.pending);
  const projectId = pendingComment?.projectId ?? null;
  const scopeId = pendingComment?.scopeId ?? null;

  // count of the rows a key may resolve to (stays undefined, and the queries
  // idle, when nothing is pending)
  const targetsCount = useLiveQuery(async () => {
    if (!projectId) return null;
    const [baseMapsCount, templatesCount] = await Promise.all([
      db.baseMaps.where("projectId").equals(projectId).count(),
      db.annotationTemplates.where("projectId").equals(projectId).count(),
    ]);
    return baseMapsCount + templatesCount;
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !scopeId || targetsCount == null) return;
    bindSeededCommentsService({ projectId, scopeId }).catch((error) => {
      // e.g. a write refused by a read-only scope
      console.error("[comments] seeded comments not bound", error);
    });
  }, [projectId, scopeId, targetsCount]);
}
