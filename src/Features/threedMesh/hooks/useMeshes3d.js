import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Live list of 3D mesh cells ("mailles") for the given project + scope,
// excluding soft-deleted records. useLiveQuery re-runs automatically on any
// write to the meshes3d table.
export default function useMeshes3d({ projectId, scopeId } = {}) {
  return useLiveQuery(async () => {
    if (!projectId || !scopeId) return [];
    const records = await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    return records.filter((r) => !r.deletedAt);
  }, [projectId, scopeId]);
}
