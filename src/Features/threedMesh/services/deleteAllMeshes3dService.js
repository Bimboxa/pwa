import db from "App/db/db";

// Ids of the live (not soft-deleted) mailles of a scope.
export async function getLiveMeshes3dIds({ projectId, scopeId }) {
  if (!projectId || !scopeId) return [];
  const rows = await db.meshes3d
    .where("[projectId+scopeId]")
    .equals([projectId, scopeId])
    .toArray();
  return rows.filter((r) => !r.deletedAt).map((r) => r.id);
}

// « Supprimer toutes les mailles » (command DELETE_ALL_MESHES): deletes
// every maille of the scope in ONE write (soft delete — numbers are never
// reused, see buildMesh3dRecord). Returns the number of deleted mailles.
export default async function deleteAllMeshes3dService({ projectId, scopeId }) {
  return db.transaction("rw", db.meshes3d, async () => {
    const ids = await getLiveMeshes3dIds({ projectId, scopeId });
    if (ids.length) await db.meshes3d.bulkDelete(ids);
    return ids.length;
  });
}
