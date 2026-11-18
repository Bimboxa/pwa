import db from "App/db/db";

import groupAdjacentMeshes3d from "../utils/groupAdjacentMeshes3d";
import mergeMesh3dGeometries from "../utils/mergeMesh3dGeometries";

// « Fusionner les mailles adjacentes » (Maillage module, command
// MERGE_ADJACENT_MESHES): every group of mailles of the scope touching along
// a stretch no cut line separates (groupAdjacentMeshes3d) becomes ONE
// maille. Like mergeMeshes3dService, the survivor of a group is its maille
// with the LOWEST number (it keeps id / number / label / color), the others
// are soft-deleted, and the seams are dropped.
//
// `cutLines`: world polylines of the visible cut lines ([[{x, y, z}]]).
// `meshIds` / `annotationIds` (optional): scope of a run on a selection —
// only the mailles with one of these ids, or created from one of these
// annotations (`sourceInfo.annotationId`), are candidates; the others are
// neither merged nor used as a bridge between two candidates. Without any,
// the whole scope.
//
// Returns { groups, removedIds } — the number of merged groups and the ids
// of the mailles they absorbed.
export default async function mergeAdjacentMeshes3dService({
  projectId,
  scopeId,
  cutLines,
  meshIds,
  annotationIds,
}) {
  if (!projectId || !scopeId) return { groups: 0, removedIds: [] };
  const scoped = meshIds?.length > 0 || annotationIds?.length > 0;
  const meshIdSet = new Set(meshIds || []);
  const annotationIdSet = new Set(annotationIds || []);

  return db.transaction("rw", db.meshes3d, async () => {
    const rows = (
      await db.meshes3d
        .where("[projectId+scopeId]")
        .equals([projectId, scopeId])
        .toArray()
    ).filter(
      (r) =>
        !r.deletedAt &&
        (!scoped ||
          meshIdSet.has(r.id) ||
          annotationIdSet.has(r.sourceInfo?.annotationId))
    );

    const updates = [];
    const removedIds = [];
    for (const group of groupAdjacentMeshes3d(rows, cutLines)) {
      const sorted = [...group].sort(
        (r1, r2) => (r1.number || 0) - (r2.number || 0)
      );
      const geometry = mergeMesh3dGeometries(sorted);
      if (!geometry) continue;
      const [survivor, ...others] = sorted;
      updates.push({ key: survivor.id, changes: { ...geometry, seams: [] } });
      removedIds.push(...others.map((r) => r.id));
    }

    // One write per kind for the whole run (the meshes3d live queries and
    // the 3D scene rebuild once).
    if (updates.length) await db.meshes3d.bulkUpdate(updates);
    if (removedIds.length) await db.meshes3d.bulkDelete(removedIds);

    return { groups: updates.length, removedIds };
  });
}
