import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live list of 3D dimensions ("cotes") for the given project + scope, excluding
// soft-deleted records. useLiveQuery re-runs automatically on any write to the
// dimensions3d table (create / soft-delete), so no manual trigger is needed.
export default function useDimensions3d({ projectId, scopeId } = {}) {
  return useLiveQuery(async () => {
    if (!projectId || !scopeId) return [];
    const records = await db.dimensions3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    return records.filter((r) => !r.deletedAt);
  }, [projectId, scopeId]);
}
