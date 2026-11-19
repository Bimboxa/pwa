import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Number the next created maille of the scope gets by default: 1 + the
// highest number over ALL the rows, soft-deleted included (numbers are never
// reused — see buildMesh3dRecord). Live; undefined while loading.
export default function useNextMesh3dNumber({ projectId, scopeId } = {}) {
  return useLiveQuery(async () => {
    if (!projectId || !scopeId) return 1;
    const rows = await db.meshes3d
      .where("[projectId+scopeId]")
      .equals([projectId, scopeId])
      .toArray();
    return 1 + rows.reduce((max, r) => Math.max(max, r.number || 0), 0);
  }, [projectId, scopeId]);
}
