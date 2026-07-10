import db from "App/db/db";

// Returns a `deleteMeshes3d(ids)` function. The soft-delete middleware turns
// the delete into a `deletedAt` stamp; numbers are never reused since the
// allocation reads soft-deleted rows too.
export default function useDeleteMeshes3d() {
  return async (mesh3dIds) => {
    const ids = (mesh3dIds || []).filter(Boolean);
    if (!ids.length) return;
    await db.meshes3d.bulkDelete(ids);
  };
}
